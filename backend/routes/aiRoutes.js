/**
 * AI Routes - Single Endpoint Architecture
 * All AI features through unified API
 */

const express = require("express");
const router = express.Router();
const aiService = require("../services/aiService");
const Property = require("../models/Property");
const User = require("../models/User");

/* ================= PROPERTY SCORE ================= */

// Get AI score for a property
router.get("/score/:propertyId", async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check if we have cached insights in DB
    if (property.aiInsights?.score && property.aiInsights?.generatedAt) {
      const hoursSinceGenerated = (Date.now() - new Date(property.aiInsights.generatedAt)) / (1000 * 60 * 60);
      if (hoursSinceGenerated < 24) {
        return res.json({
          cached: true,
          score: property.aiInsights.score,
          priceRating: property.aiInsights.priceRating,
          locationQuality: property.aiInsights.locationQuality,
          highlights: property.aiInsights.highlights || [],
          concerns: property.aiInsights.concerns || [],
          summary: property.aiInsights.summary || "Analysis available"
        });
      }
    }

    // Generate fresh score
    const scoreData = await aiService.generatePropertyScore(property);
    
    if (scoreData && scoreData.score) {
      // Save to property
      property.aiInsights = {
        ...property.aiInsights,
        score: scoreData.score,
        priceRating: scoreData.priceRating,
        locationQuality: scoreData.locationQuality,
        highlights: scoreData.highlights || [],
        concerns: scoreData.concerns || [],
        summary: scoreData.summary,
        generatedAt: new Date()
      };
      await property.save();
      
      return res.json({ cached: false, ...scoreData });
    }
    
    // If AI failed, return a basic fallback score
    const fallbackScore = {
      score: 65,
      priceRating: "FAIR",
      locationQuality: "GOOD",
      highlights: ["Property listed on AuraSpot"],
      concerns: [],
      summary: "This property is available for viewing. Contact the owner for more details."
    };
    
    return res.json({ cached: false, fallback: true, ...fallbackScore });
  } catch (error) {
    console.error("AI Score error:", error);
    // Return fallback instead of error
    res.json({ 
      cached: false, 
      fallback: true,
      score: 60,
      priceRating: "FAIR",
      locationQuality: "AVERAGE",
      highlights: ["Listed property"],
      concerns: [],
      summary: "AI analysis temporarily unavailable. Please check back later."
    });
  }
});

/* ================= FRAUD DETECTION ================= */

// Check fraud risk for a property
router.get("/fraud-check/:propertyId", async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId).populate("owner", "name email createdAt");
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check cached fraud data
    if (property.aiInsights?.fraudRisk && property.aiInsights?.generatedAt) {
      const hoursSinceGenerated = (Date.now() - new Date(property.aiInsights.generatedAt)) / (1000 * 60 * 60);
      if (hoursSinceGenerated < 24) {
        return res.json({
          cached: true,
          riskLevel: property.aiInsights.fraudRisk,
          riskScore: property.aiInsights.fraudScore,
          flags: property.aiInsights.fraudFlags
        });
      }
    }

    const ownerInfo = {
      verified: property.owner?.verified || false,
      memberSince: property.owner?.createdAt
    };

    const fraudData = await aiService.calculateFraudRisk(property, ownerInfo);
    
    if (fraudData) {
      property.aiInsights = {
        ...property.aiInsights,
        fraudRisk: fraudData.riskLevel,
        fraudScore: fraudData.riskScore,
        fraudFlags: fraudData.flags,
        generatedAt: new Date()
      };
      await property.save();
    }

    res.json({ cached: false, ...fraudData });
  } catch (error) {
    console.error("Fraud check error:", error);
    res.status(500).json({ message: "Failed to check fraud risk", error: error.message });
  }
});

/* ================= USER-PROPERTY MATCHING ================= */

// Get matched properties for a user
router.post("/match", async (req, res) => {
  try {
    const { userEmail, budget, preferredCity, lookingFor, preferences, userType } = req.body;

    // Build query for properties
    const query = { status: "AVAILABLE" };
    if (lookingFor) query.listingType = lookingFor;
    if (preferredCity) query.city = new RegExp(preferredCity, "i");
    if (budget?.max) query.price = { $lte: budget.max };

    const properties = await Property.find(query).limit(20).sort({ createdAt: -1 });

    if (properties.length === 0) {
      return res.json({ matches: [], suggestion: "No properties found matching your criteria" });
    }

    const userProfile = {
      email: userEmail,
      userType: userType || "general",
      budget,
      preferredCity,
      lookingFor,
      preferences
    };

    const matchData = await aiService.matchUserToProperties(userProfile, properties);

    // Enrich matches with full property data
    if (matchData?.matches) {
      matchData.matches = matchData.matches.map(m => ({
        ...m,
        property: properties[m.propertyIndex - 1] || null
      })).filter(m => m.property);
    }

    res.json(matchData);
  } catch (error) {
    console.error("Match error:", error);
    res.status(500).json({ message: "Failed to match properties", error: error.message });
  }
});

/* ================= RENT SUGGESTION ================= */

// Get smart rent suggestion
router.get("/rent-suggestion/:propertyId", async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    if (property.listingType !== "rent") {
      return res.status(400).json({ message: "Rent suggestion only available for rental properties" });
    }

    // Check cached suggestion
    if (property.aiInsights?.rentSuggestion && property.aiInsights?.generatedAt) {
      const hoursSinceGenerated = (Date.now() - new Date(property.aiInsights.generatedAt)) / (1000 * 60 * 60);
      if (hoursSinceGenerated < 48) {
        return res.json({ cached: true, ...property.aiInsights.rentSuggestion });
      }
    }

    const rentData = await aiService.suggestRentPrice(property);
    
    if (rentData) {
      property.aiInsights = {
        ...property.aiInsights,
        rentSuggestion: rentData,
        generatedAt: new Date()
      };
      await property.save();
    }

    res.json({ cached: false, ...rentData });
  } catch (error) {
    console.error("Rent suggestion error:", error);
    res.status(500).json({ message: "Failed to generate rent suggestion", error: error.message });
  }
});

/* ================= MAINTENANCE PRIORITY ================= */

// Predict maintenance priority
router.post("/maintenance-priority", async (req, res) => {
  try {
    const { requestId, category, title, description, status, createdAt } = req.body;

    const request = {
      _id: requestId || "temp",
      category,
      title,
      description,
      status: status || "PENDING",
      createdAt: createdAt || new Date()
    };

    const priorityData = await aiService.predictMaintenancePriority(request);
    res.json(priorityData);
  } catch (error) {
    console.error("Maintenance priority error:", error);
    res.status(500).json({ message: "Failed to predict priority", error: error.message });
  }
});

/* ================= AI CHAT ================= */

// Property-specific chat
router.post("/chat/:propertyId", async (req, res) => {
  try {
    const { question, chatHistory } = req.body;
    
    const property = await Property.findById(req.params.propertyId).populate("owner", "name");
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const propertyDetails = `
Title: ${property.title}
Type: ${property.type} (${property.listingType})
Location: ${property.area || ""}, ${property.city}
Price: ₹${property.price.toLocaleString()}${property.listingType === "rent" ? "/month" : ""}
BHK: ${property.bhk || "N/A"}
Sqft: ${property.sqft || "N/A"}
Furnishing: ${property.furnishing || "N/A"}
Amenities: ${property.amenities?.join(", ") || "Not specified"}
Description: ${property.description || "No description"}
Owner: ${property.owner?.name || "Unknown"}
AI Score: ${property.aiInsights?.score || "Not rated"}
Price Rating: ${property.aiInsights?.priceRating || "Not analyzed"}
`;

    // Pass the property object for market data context
    const response = await aiService.propertyChat(propertyDetails, question, chatHistory || [], property);
    res.json({ response });
  } catch (error) {
    console.error("AI Chat error:", error);
    res.status(500).json({ message: "Failed to get AI response", error: error.message });
  }
});

/* ================= FULL INSIGHTS ================= */

// Generate all insights for a property
router.post("/generate-insights/:propertyId", async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Clear existing cache
    aiService.clearPropertyCache(req.params.propertyId);

    // Generate fresh insights
    const insights = await aiService.generatePropertyInsights(property);
    
    if (insights) {
      property.aiInsights = insights;
      await property.save();
    }

    res.json({ success: true, insights });
  } catch (error) {
    console.error("Generate insights error:", error);
    res.status(500).json({ message: "Failed to generate insights", error: error.message });
  }
});

/* ================= CACHE MANAGEMENT ================= */

// Get cache stats (admin)
router.get("/cache-stats", (req, res) => {
  const stats = aiService.getCacheStats();
  res.json(stats);
});

// Clear cache for property
router.delete("/cache/:propertyId", (req, res) => {
  aiService.clearPropertyCache(req.params.propertyId);
  res.json({ success: true, message: "Cache cleared" });
});

module.exports = router;
