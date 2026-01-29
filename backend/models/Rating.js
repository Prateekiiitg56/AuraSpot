const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    // User giving the rating
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // User receiving the rating
    ratee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Property associated with the rating (for context)
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },

    // Rating value (1-5 stars)
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },

    // Optional review text
    review: {
      type: String,
      default: "",
      maxlength: 500
    },

    // Type of rating (owner rating tenant, or tenant rating owner)
    ratingType: {
      type: String,
      enum: ["TENANT_TO_OWNER", "OWNER_TO_TENANT"],
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate ratings for the same property transaction
ratingSchema.index({ rater: 1, ratee: 1, property: 1 }, { unique: true });

module.exports = mongoose.model("Rating", ratingSchema);
