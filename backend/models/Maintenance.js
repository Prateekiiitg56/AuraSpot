const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema(
  {
    // Property this request is for
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },

    // Tenant who submitted the request
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Property owner
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    // Type of maintenance issue
    category: {
      type: String,
      enum: ["PLUMBING", "ELECTRICAL", "APPLIANCE", "HVAC", "STRUCTURAL", "PEST_CONTROL", "CLEANING", "OTHER"],
      required: true
    },

    // Issue title
    title: {
      type: String,
      required: true,
      maxlength: 100
    },

    // Detailed description of the issue
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },

    // Priority level
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM"
    },

    // Current status
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "IN_PROGRESS", "RESOLVED", "REJECTED"],
      default: "PENDING"
    },

    // Assigned worker/contractor
    assignedWorker: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      specialty: { type: String, default: "" }
    },

    // Estimated cost (owner can add)
    estimatedCost: {
      type: Number,
      default: 0
    },

    // Actual cost after completion
    actualCost: {
      type: Number,
      default: 0
    },

    // Scheduled date for repair
    scheduledDate: {
      type: Date,
      default: null
    },

    // Date when resolved
    resolvedDate: {
      type: Date,
      default: null
    },

    // Images of the issue (filenames)
    images: [String],

    // Comments/updates history
    updates: [{
      message: String,
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      role: {
        type: String,
        enum: ["TENANT", "OWNER", "WORKER"]
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],

    // Tenant rating after resolution
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },

    ratingFeedback: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
maintenanceSchema.index({ property: 1, status: 1 });
maintenanceSchema.index({ tenant: 1, status: 1 });
maintenanceSchema.index({ owner: 1, status: 1 });

module.exports = mongoose.model("Maintenance", maintenanceSchema);
