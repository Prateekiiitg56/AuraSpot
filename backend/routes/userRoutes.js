const router = require("express").Router();
const User = require("../models/User");
const Property = require("../models/Property");
const Rating = require("../models/Rating");
const { calculateTrustBadge, getBadgeInfo } = require("../utils/scoreCalculator");

// Store OTPs in memory (in production, use Redis or database)
const otpStore = {};

// Generate random OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

router.get("/email/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.json(user);
  } catch (err) {
    console.error("GET USER BY EMAIL ERROR:", err);
    res.status(500).json({ message: "Failed to get user" });
  }
});

// Update user profile
router.put("/profile", async (req, res) => {
  try {
    const { email, name, phone, location, bio, socials } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { name, phone, location, bio, socials },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// Submit verification documents
router.post("/verify", async (req, res) => {
  try {
    const { email, documentType, documentNumber } = req.body;

    if (!email || !documentType || !documentNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Add verification document
    user.verificationDocuments.push({
      type: documentType,
      documentNumber,
      uploadedAt: new Date()
    });

    // Auto-verify if document is submitted (in production, this would be manual review)
    user.verified = true;

    await user.save();

    res.json({ message: "Verification submitted successfully", user });
  } catch (err) {
    console.error("VERIFICATION ERROR:", err);
    res.status(500).json({ message: "Failed to submit verification" });
  }
});

// Send OTP for phone verification
router.post("/send-otp", async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: "Email and phone are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP with timestamp (expires in 5 minutes)
    otpStore[phone] = {
      otp,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0
    };

    // In production, send OTP via SMS service like Twilio
    // For now, we'll log it and return in development
    console.log(`OTP for ${phone}: ${otp}`);

    res.json({ 
      message: "OTP sent successfully",
      // In production, remove this line. For testing only:
      otp: process.env.NODE_ENV === "production" ? undefined : otp
    });
  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// Verify OTP and update phone
router.post("/verify-phone-otp", async (req, res) => {
  try {
    const { email, phone, otp } = req.body;

    if (!email || !phone || !otp) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const otpData = otpStore[phone];

    // Check if OTP exists
    if (!otpData) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    // Check if OTP is expired
    if (Date.now() > otpData.expiresAt) {
      delete otpStore[phone];
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    // Check attempt limit
    if (otpData.attempts >= 3) {
      delete otpStore[phone];
      return res.status(400).json({ message: "Too many attempts. Please request a new OTP." });
    }

    // Verify OTP
    if (otpData.otp !== otp) {
      otpData.attempts++;
      return res.status(400).json({ message: "Invalid OTP. Please try again." });
    }

    // Check email matches
    if (otpData.email !== email) {
      return res.status(400).json({ message: "Email does not match OTP request." });
    }

    // Update phone number
    const user = await User.findOneAndUpdate(
      { email },
      { phone },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Clear OTP after successful verification
    delete otpStore[phone];

    // Mark phone as verified
    user.phoneVerified = true;
    await user.save();

    res.json({ 
      message: "Phone verified and updated successfully",
      user
    });
  } catch (err) {
    console.error("VERIFY PHONE OTP ERROR:", err);
    res.status(500).json({ message: "Failed to verify phone OTP" });
  }
});

/* ================= USER STATS (Properties + Active Deals) ================= */

router.get("/stats/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Count properties owned by user
    const propertiesListed = await Property.countDocuments({ owner: userId });
    
    // Count active deals (REQUESTED or BOOKED status where user is owner)
    const activeDeals = await Property.countDocuments({ 
      owner: userId,
      status: { $in: ["REQUESTED", "BOOKED"] }
    });
    
    // Count completed deals (SOLD status)
    const completedDeals = await Property.countDocuments({ 
      owner: userId,
      status: "SOLD"
    });
    
    // Get user's trust info
    const user = await User.findById(userId);
    
    res.json({
      propertiesListed,
      activeDeals,
      completedDeals,
      totalDeals: activeDeals + completedDeals,
      rating: user?.rating || 0,
      totalRatings: user?.totalRatings || 0,
      successfulDeals: user?.successfulDeals || 0,
      trustBadge: user?.trustBadge || "NEW_SELLER",
      badgeInfo: getBadgeInfo(user?.trustBadge)
    });
  } catch (err) {
    console.error("USER STATS ERROR:", err);
    res.status(500).json({ message: "Failed to get user stats" });
  }
});

/* ================= RATE USER (After Deal) ================= */

router.post("/rate", async (req, res) => {
  try {
    const { rateeEmail, raterEmail, rating, propertyId, review, ratingType } = req.body;
    
    if (!rateeEmail || !raterEmail || !rating || !propertyId) {
      return res.status(400).json({ message: "Ratee email, rater email, rating, and property ID are required" });
    }
    
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Get both users
    const ratee = await User.findOne({ email: rateeEmail });
    const rater = await User.findOne({ email: raterEmail });
    
    if (!ratee) {
      return res.status(404).json({ message: "User to rate not found" });
    }
    if (!rater) {
      return res.status(404).json({ message: "Rater not found" });
    }

    // Prevent self-rating
    if (ratee._id.equals(rater._id)) {
      return res.status(400).json({ message: "You cannot rate yourself" });
    }

    // Check if this rating already exists
    const existingRating = await Rating.findOne({
      rater: rater._id,
      ratee: ratee._id,
      property: propertyId
    });

    if (existingRating) {
      return res.status(400).json({ message: "You have already rated this user for this deal" });
    }

    // Create the rating record
    await Rating.create({
      rater: rater._id,
      ratee: ratee._id,
      property: propertyId,
      rating,
      review: review || "",
      ratingType: ratingType || "TENANT_TO_OWNER"
    });
    
    // Calculate new average rating for the ratee
    const currentTotal = (ratee.rating || 0) * (ratee.totalRatings || 0);
    const newTotalRatings = (ratee.totalRatings || 0) + 1;
    const newRating = (currentTotal + rating) / newTotalRatings;
    
    ratee.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal
    ratee.totalRatings = newTotalRatings;
    ratee.trustBadge = calculateTrustBadge(ratee);
    
    await ratee.save();
    
    res.json({
      message: "Rating submitted successfully",
      newRating: ratee.rating,
      totalRatings: ratee.totalRatings,
      trustBadge: ratee.trustBadge,
      badgeInfo: getBadgeInfo(ratee.trustBadge)
    });
  } catch (err) {
    console.error("RATE USER ERROR:", err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "You have already rated this user for this deal" });
    }
    res.status(500).json({ message: "Failed to submit rating" });
  }
});

/* ================= CHECK IF USER HAS RATED ================= */

router.get("/rating/check", async (req, res) => {
  try {
    const { raterEmail, rateeEmail, propertyId } = req.query;
    
    if (!raterEmail || !rateeEmail || !propertyId) {
      return res.status(400).json({ message: "Rater email, ratee email, and property ID are required" });
    }

    const rater = await User.findOne({ email: raterEmail });
    const ratee = await User.findOne({ email: rateeEmail });

    if (!rater || !ratee) {
      return res.json({ hasRated: false });
    }

    const existingRating = await Rating.findOne({
      rater: rater._id,
      ratee: ratee._id,
      property: propertyId
    });

    res.json({ 
      hasRated: !!existingRating,
      rating: existingRating ? existingRating.rating : null,
      review: existingRating ? existingRating.review : null
    });
  } catch (err) {
    console.error("CHECK RATING ERROR:", err);
    res.status(500).json({ message: "Failed to check rating" });
  }
});

/* ================= GET USER'S RECEIVED RATINGS ================= */

router.get("/ratings/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const ratings = await Rating.find({ ratee: user._id })
      .populate("rater", "name email")
      .populate("property", "title city area")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (err) {
    console.error("GET RATINGS ERROR:", err);
    res.status(500).json({ message: "Failed to get ratings" });
  }
});

/* ================= GET OWNER PUBLIC PROFILE ================= */

router.get("/owner/:ownerId", async (req, res) => {
  try {
    const owner = await User.findById(req.params.ownerId)
      .select("name email phone location verified rating totalRatings successfulDeals trustBadge isGoogleLogin emailVerified phoneVerified bio socials createdAt");
    
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }
    
    // Get owner's properties count
    const propertiesCount = await Property.countDocuments({ owner: req.params.ownerId });
    
    const ownerObj = owner.toObject();
    ownerObj.propertiesCount = propertiesCount;
    ownerObj.badgeInfo = getBadgeInfo(owner.trustBadge);
    
    res.json(ownerObj);
  } catch (err) {
    console.error("GET OWNER ERROR:", err);
    res.status(500).json({ message: "Failed to get owner profile" });
  }
});

/* ================= UPDATE GOOGLE LOGIN STATUS (on sync) ================= */

router.post("/sync", async (req, res) => {
  try {
    const { firebaseUid, name, email, isGoogleLogin } = req.body;

    let user = await User.findOne({ firebaseUid });

    if (!user) {
      user = await User.create({
        firebaseUid,
        name,
        email,
        role: "USER",
        isGoogleLogin: isGoogleLogin || false,
        emailVerified: true, // Firebase already verifies email
        trustBadge: "NEW_SELLER"
      });
    } else {
      // Update Google login status if changed
      if (isGoogleLogin && !user.isGoogleLogin) {
        user.isGoogleLogin = true;
        user.trustBadge = calculateTrustBadge(user);
        await user.save();
      }
    }

    res.json(user);
  } catch (err) {
    console.error("USER SYNC ERROR:", err);
    res.status(500).json({ message: "Failed to sync user" });
  }
});

module.exports = router;
