const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: String,

    type: {
      type: String,
      enum: ["ROOM", "PG", "HOSTEL", "FLAT", "HOME"],
      required: true
    },

    purpose: {
      type: String,
      enum: ["RENT", "SALE"],
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    city: String,
    area: String,

    // Support for multiple images (up to 5)
    images: [String],
    
    // Keep single image for backward compatibility
    image: String,

    latitude: Number,
    longitude: Number,

    amenities: [String],

    description: String,

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // 🔄 PROPERTY FLOW (real marketplace logic)
    status: {
      type: String,
      enum: ["AVAILABLE", "REQUESTED", "BOOKED", "SOLD"],
      default: "AVAILABLE"
    },

    // 👤 User who rented/bought
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    // Smart Property Score fields
    viewCount: {
      type: Number,
      default: 0
    },

    contactRequests: {
      type: Number,
      default: 0
    },

    // Cached property score (updated when viewed/requested)
    propertyScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },

    // Score breakdown for display
    scoreBreakdown: {
      location: { type: Number, default: 0 },
      priceFairness: { type: Number, default: 0 },
      amenities: { type: Number, default: 0 },
      demand: { type: Number, default: 0 },
      ownerCredibility: { type: Number, default: 0 }
    },

    // AI-Generated Insights (cached)
    aiInsights: {
      score: { type: Number, min: 0, max: 100 },
      priceRating: { type: String, enum: ["SUSPICIOUS", "EXCELLENT", "GOOD", "FAIR", "ABOVE_AVERAGE", "OVERPRICED", "VERY_OVERPRICED"] },
      locationQuality: { type: String, enum: ["PRIME", "GOOD", "AVERAGE", "DEVELOPING"] },
      highlights: [String],
      concerns: [String],
      summary: String,
      fraudRisk: { type: String, enum: ["LOW", "MEDIUM", "HIGH"] },
      fraudScore: { type: Number, min: 0, max: 100 },
      fraudFlags: [String],
      rentSuggestion: {
        suggestedRent: Number,
        rentRange: {
          min: Number,
          max: Number
        },
        currentPriceAssessment: String,
        marketInsight: String,
        negotiationTip: String
      },
      generatedAt: Date
    },

    // Listing type (rent/sale) for easier querying
    listingType: {
      type: String,
      enum: ["rent", "sale"],
      default: "rent"
    },

    // Additional fields for AI matching
    bhk: Number,
    sqft: Number,
    furnishing: {
      type: String,
      enum: ["Furnished", "Semi-Furnished", "Unfurnished"],
      default: "Unfurnished"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Property", propertySchema);
