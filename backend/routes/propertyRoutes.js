const express = require("express");
const Property = require("../models/Property");
const User = require("../models/User");
const Notification = require("../models/Notification");
const RentAgreement = require("../models/RentAgreement");
const multer = require("multer");
const { calculatePropertyScore, getScoreDescription, calculateTrustBadge } = require("../utils/scoreCalculator");
const { calculateAIMatchScore, getAISuggestions } = require("../utils/aiMatchEngine");
const aiService = require("../services/aiService");

const router = express.Router();

/* ================= MULTER ================= */

// Use memory storage for serverless (Vercel has read-only filesystem)
// For production, you should upload to cloud storage (Cloudinary, S3, etc.)
const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/* ================= CREATE PROPERTY ================= */

router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.body.ownerEmail });
    if (!owner) return res.status(400).json({ message: "Owner not found" });

    // Handle amenities - could be JSON array or comma-separated string
    let amenities = [];
    const rawAmenities = req.body.amenities || "";
    
    if (typeof rawAmenities === "string") {
      // Try parsing as JSON first (for backward compatibility)
      try {
        const parsed = JSON.parse(rawAmenities);
        if (Array.isArray(parsed)) {
          amenities = parsed.map(a => String(a).trim()).filter(Boolean);
        } else {
          amenities = String(rawAmenities).split(",").map(a => a.trim()).filter(Boolean);
        }
      } catch {
        // Not JSON, split by comma
        amenities = String(rawAmenities).split(",").map(a => a.trim()).filter(Boolean);
      }
    } else if (Array.isArray(rawAmenities)) {
      amenities = rawAmenities.map(a => String(a).trim()).filter(Boolean);
    }

    // Handle multiple images - with memory storage, files are in buffer
    // For production, upload to cloud storage (Cloudinary/S3) and store URLs
    // For now, we'll store placeholder names or skip if no cloud storage configured
    const imageFiles = req.files || [];
    let imageFilenames = [];
    
    if (imageFiles.length > 0) {
      // In serverless, we can't save to disk. Store as placeholder or implement cloud upload
      // For now, generate unique names (in production, these would be cloud URLs)
      imageFilenames = imageFiles.map((file, index) => 
        `property_${Date.now()}_${index}_${file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`
      );
    }

    const property = await Property.create({
      title: req.body.title,
      type: req.body.type,
      purpose: req.body.purpose,
      price: Number(req.body.price),
      city: req.body.city,
      area: req.body.area,
      latitude: Number(req.body.latitude),
      longitude: Number(req.body.longitude),
      amenities,
      description: req.body.description,
      images: imageFilenames,
      image: imageFilenames[0] || null, // Keep first image for backward compatibility
      owner: owner._id,
      status: "AVAILABLE",
      // Set listing type based on purpose
      listingType: req.body.purpose?.toLowerCase() === "sale" ? "sale" : "rent",
      bhk: req.body.bhk ? Number(req.body.bhk) : undefined,
      sqft: req.body.sqft ? Number(req.body.sqft) : undefined,
      furnishing: req.body.furnishing || "Unfurnished"
    });

    // Background AI insights generation (non-blocking)
    aiService.generatePropertyInsights(property)
      .then(insights => {
        if (insights) {
          Property.findByIdAndUpdate(property._id, { aiInsights: insights }).catch(console.error);
          console.log(`[AI] Generated insights for property ${property._id}`);
        }
      })
      .catch(err => console.error("[AI] Background insights error:", err));

    res.json(property);
  } catch (err) {
    console.error("CREATE PROPERTY ERROR:", err);
    res.status(500).json({ message: "Failed to add property" });
  }
});

/* ================= EXPLORE (ONLY AVAILABLE) ================= */

router.get("/", async (req, res) => {
  try {
    const properties = await Property.find({ status: "AVAILABLE" })
      .sort({ createdAt: -1 })
      .populate("owner", "name email verified rating successfulDeals trustBadge isGoogleLogin emailVerified phoneVerified");

    // Calculate scores for all properties
    const propertiesWithScores = properties.map(prop => {
      const scoreResult = calculatePropertyScore(prop, prop.owner);
      const propObj = prop.toObject();
      propObj.propertyScore = scoreResult.totalScore;
      propObj.scoreBreakdown = scoreResult.breakdown;
      propObj.scoreDescription = getScoreDescription(scoreResult.totalScore, scoreResult.breakdown);
      return propObj;
    });

    res.json(propertiesWithScores);
  } catch (err) {
    console.error("EXPLORE ERROR:", err);
    res.status(500).json({ message: "Failed to load properties" });
  }
});

router.get("/all", async (req, res) => {
  try {
    const properties = await Property.find()
      .populate("owner", "name email")
      .populate("assignedTo", "name email");

    res.json(properties);
  } catch (err) {
    console.error("GET ALL ERROR:", err);
    res.status(500).json({ message: "Failed to load all properties" });
  }
});


/* ================= OWNER LISTINGS ================= */

router.get("/owner/:ownerId", async (req, res) => {
  try {
    const properties = await Property.find({
      owner: req.params.ownerId
    }).sort({ createdAt: -1 });

    res.json(properties);
  } catch (err) {
    console.error("OWNER LISTINGS ERROR:", err);
    res.status(500).json({ message: "Failed to load owner properties" });
  }
});

/* ================= PROPERTY DETAILS ================= */

router.get("/:id", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id)
      .populate("owner", "name email verified rating totalRatings successfulDeals trustBadge isGoogleLogin emailVerified phoneVerified")
      .populate("assignedTo", "name email");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Increment view count
    property.viewCount = (property.viewCount || 0) + 1;
    
    // Calculate property score
    const scoreResult = calculatePropertyScore(property, property.owner);
    property.propertyScore = scoreResult.totalScore;
    property.scoreBreakdown = scoreResult.breakdown;
    
    // Try to save, but don't fail if there's a validation error
    try {
      await property.save();
    } catch (saveErr) {
      // If save fails (e.g., aiInsights validation error), just log and continue
      console.error("Property save warning:", saveErr.message);
    }
    
    // Add score description to response
    const propertyObj = property.toObject();
    propertyObj.scoreDescription = getScoreDescription(scoreResult.totalScore, scoreResult.breakdown);

    res.json(propertyObj);
  } catch (err) {
    console.error("PROPERTY DETAILS ERROR:", err);
    res.status(500).json({ message: "Failed to load property details" });
  }
});

/* ================= DELETE ================= */

router.delete("/:id", async (req, res) => {
  try {
    // Delete all notifications related to this property
    await Notification.deleteMany({ property: req.params.id });
    
    // Delete all chat messages related to this property
    const Chat = require("../models/Chat");
    await Chat.deleteMany({ property: req.params.id });
    
    // Delete the property
    await Property.findByIdAndDelete(req.params.id);
    
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Failed to delete property" });
  }
});

/* ================= UPDATE PROPERTY ================= */

router.put("/:id", upload.array("images", 5), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate("owner");
    
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Verify ownership
    const ownerEmail = req.body.ownerEmail;
    if (property.owner.email !== ownerEmail) {
      return res.status(403).json({ message: "You can only edit your own properties" });
    }

    // Handle amenities - could be JSON array or comma-separated string
    let amenities = property.amenities;
    if (req.body.amenities !== undefined) {
      const rawAmenities = req.body.amenities || "";
      if (typeof rawAmenities === "string") {
        try {
          const parsed = JSON.parse(rawAmenities);
          if (Array.isArray(parsed)) {
            amenities = parsed.map(a => String(a).trim()).filter(Boolean);
          } else {
            amenities = String(rawAmenities).split(",").map(a => a.trim()).filter(Boolean);
          }
        } catch {
          amenities = String(rawAmenities).split(",").map(a => a.trim()).filter(Boolean);
        }
      } else if (Array.isArray(rawAmenities)) {
        amenities = rawAmenities.map(a => String(a).trim()).filter(Boolean);
      }
    }

    // Handle new images if uploaded
    const imageFiles = req.files || [];
    let images = property.images || [];
    if (imageFiles.length > 0) {
      const newImageFilenames = imageFiles.map(file => file.filename);
      images = [...images, ...newImageFilenames].slice(0, 5); // Keep max 5 images
    }

    // Update fields
    const updateData = {
      title: req.body.title || property.title,
      type: req.body.type || property.type,
      purpose: req.body.purpose || property.purpose,
      price: req.body.price ? Number(req.body.price) : property.price,
      city: req.body.city || property.city,
      area: req.body.area || property.area,
      description: req.body.description !== undefined ? req.body.description : property.description,
      amenities,
      images,
      image: images[0] || property.image,
      bhk: req.body.bhk ? Number(req.body.bhk) : property.bhk,
      sqft: req.body.sqft ? Number(req.body.sqft) : property.sqft,
      furnishing: req.body.furnishing || property.furnishing,
      listingType: req.body.purpose?.toLowerCase() === "sale" ? "sale" : "rent"
    };

    // Only update coordinates if provided
    if (req.body.latitude) updateData.latitude = Number(req.body.latitude);
    if (req.body.longitude) updateData.longitude = Number(req.body.longitude);

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate("owner", "name email");

    // Clear AI cache and regenerate insights
    aiService.clearPropertyCache(req.params.id);
    aiService.generatePropertyInsights(updatedProperty)
      .then(insights => {
        if (insights) {
          Property.findByIdAndUpdate(req.params.id, { aiInsights: insights }).catch(console.error);
          console.log(`[AI] Regenerated insights for updated property ${req.params.id}`);
        }
      })
      .catch(err => console.error("[AI] Background insights error:", err));

    res.json(updatedProperty);
  } catch (err) {
    console.error("UPDATE PROPERTY ERROR:", err);
    res.status(500).json({ message: "Failed to update property" });
  }
});

/* ================= RESET PROPERTY TO AVAILABLE (DEBUG) ================= */

router.post("/:id/reset", async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }
    
    property.status = "AVAILABLE";
    property.assignedTo = null;
    await property.save();
    
    // Delete any notifications for this property
    await Notification.deleteMany({ property: req.params.id });
    
    res.json({ ok: true, property });
  } catch (err) {
    console.error("RESET ERROR:", err);
    res.status(500).json({ message: "Failed to reset property" });
  }
});

/* ================= SEND REQUEST ================= */

router.post("/:id/request", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const property = await Property.findById(req.params.id)
      .populate("owner");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Only block if property is actually BOOKED or SOLD (approved by owner)
    if (property.status === "BOOKED" || property.status === "SOLD") {
      return res.status(400).json({ message: "Property is no longer available" });
    }

    // Check if user already has a pending request for this property
    const existingRequest = await Notification.findOne({
      from: user._id,
      property: property._id,
      action: { $in: ["RENT", "BUY"] }
    });

    if (existingRequest) {
      return res.status(400).json({ message: "You have already requested this property" });
    }

    // Increment contact requests count (for analytics)
    property.contactRequests = (property.contactRequests || 0) + 1;
    // Keep status as AVAILABLE - property remains open for other requests
    await property.save();

    // Create notification for owner (this tracks the request)
    await Notification.create({
      from: user._id,
      to: property.owner._id,
      property: property._id,
      action: property.purpose === "RENT" ? "RENT" : "BUY",
      message: req.body.message || `${user.name || user.email} is interested in your ${property.type} for ${property.purpose}`
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("SEND REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to send request" });
  }
});

/* ================= AI RENTAL MATCH ENGINE ================= */

router.post("/ai-match", async (req, res) => {
  try {
    const { 
      preferredLocation,
      budgetMin,
      budgetMax,
      purpose,
      propertyType,
      userProfile,
      requiredAmenities
    } = req.body;

    // Fetch all available properties
    const properties = await Property.find({ status: "AVAILABLE" })
      .populate("owner", "name email verified rating successfulDeals trustBadge");

    // Calculate AI match scores for each property
    const preferences = {
      preferredLocation,
      budgetMin: Number(budgetMin) || 0,
      budgetMax: Number(budgetMax) || Infinity,
      purpose,
      propertyType,
      userProfile,
      requiredAmenities: requiredAmenities || []
    };

    const scoredProperties = properties.map(prop => {
      const propObj = prop.toObject();
      
      // Calculate regular property score
      const regularScore = calculatePropertyScore(prop, prop.owner);
      propObj.propertyScore = regularScore.totalScore;
      propObj.scoreBreakdown = regularScore.breakdown;
      
      // Calculate AI match score based on user preferences
      const aiScore = calculateAIMatchScore(prop, preferences);
      propObj.aiScore = aiScore;
      
      return propObj;
    });

    // Get categorized suggestions
    const suggestions = getAISuggestions(scoredProperties);

    res.json({
      success: true,
      totalProperties: scoredProperties.length,
      suggestions,
      allMatches: scoredProperties.sort((a, b) => b.aiScore.totalScore - a.aiScore.totalScore)
    });

  } catch (err) {
    console.error("AI MATCH ERROR:", err);
    res.status(500).json({ message: "Failed to process AI matching" });
  }
});

/* ================= OWNER ACCEPTS ================= */

router.post("/:id/approve", async (req, res) => {
  try {
    const { userId } = req.body; // The user being approved (from notification)
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const property = await Property.findById(req.params.id)
      .populate("owner");

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Property must be AVAILABLE (multiple requests possible)
    if (property.status === "BOOKED" || property.status === "SOLD") {
      return res.status(400).json({ message: "Property is already booked/sold" });
    }

    const assignedUser = await User.findById(userId);
    if (!assignedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update property status to SOLD or BOOKED and assign user
    property.status = property.purpose === "SALE" ? "SOLD" : "BOOKED";
    property.assignedTo = assignedUser._id;
    await property.save();

    // Increment owner's successful deals and update trust badge
    if (property.owner) {
      const owner = await User.findById(property.owner._id);
      if (owner) {
        owner.successfulDeals = (owner.successfulDeals || 0) + 1;
        owner.trustBadge = calculateTrustBadge(owner);
        await owner.save();
      }
    }

    // AUTO-CREATE RENT AGREEMENT for RENT properties
    if (property.purpose === "RENT" && property.assignedTo && property.owner) {
      try {
        const startDate = new Date();
        const nextPayment = new Date();
        nextPayment.setMonth(nextPayment.getMonth() + 1);
        nextPayment.setDate(Math.min(startDate.getDate(), 28));

        await RentAgreement.create({
          property: property._id,
          owner: property.owner._id,
          tenant: property.assignedTo._id,
          rentAmount: property.price,
          rentalStartDate: startDate,
          nextPaymentDate: nextPayment,
          paymentCycleDay: Math.min(startDate.getDate(), 28),
          paymentStatus: "PENDING",
          status: "ACTIVE"
        });

        // Notify tenant about rent agreement
        await Notification.create({
          from: property.owner._id,
          to: property.assignedTo._id,
          property: property._id,
          action: "RENT_AGREEMENT_CREATED",
          message: `Rent agreement created! Monthly rent: ₹${property.price}. First payment due: ${nextPayment.toLocaleDateString()}`
        });
      } catch (rentErr) {
        // Silent fail for rent agreement creation
      }
    }

    // Create notification to user that their request was accepted
    if (property.assignedTo && property.owner) {
      try {
        await Notification.create({
          from: property.owner._id,
          to: property.assignedTo._id,
          property: property._id,
          action: "ACCEPTED",
          message: `Your request for ${property.title} has been accepted!`
        });
      } catch (notifErr) {
        // Silent fail for notification
      }
    }

    // Delete ALL request notifications for this property
    try {
      await Notification.deleteMany({ 
        property: req.params.id,
        action: { $nin: ["ACCEPTED", "RENT_AGREEMENT_CREATED"] }
      });
    } catch (notifErr) {
      // Silent fail for notification cleanup
    }

    res.json({ ok: true, property });
  } catch (err) {
    console.error("APPROVE ERROR:", err);
    res.status(500).json({ message: "Failed to approve request" });
  }
});

module.exports = router;
