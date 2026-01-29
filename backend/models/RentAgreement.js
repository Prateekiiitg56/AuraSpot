const mongoose = require("mongoose");

const rentAgreementSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    rentAmount: {
      type: Number,
      required: true
    },

    securityDeposit: {
      type: Number,
      default: 0
    },

    rentalStartDate: {
      type: Date,
      required: true
    },

    rentalEndDate: {
      type: Date,
      default: null // null = ongoing, no fixed end
    },

    nextPaymentDate: {
      type: Date,
      required: true
    },

    paymentCycleDay: {
      type: Number, // Day of month for payment (1-28)
      default: 1
    },

    paymentStatus: {
      type: String,
      enum: ["PAID", "PENDING", "OVERDUE"],
      default: "PENDING"
    },

    // Agreement status
    status: {
      type: String,
      enum: ["ACTIVE", "COMPLETED", "TERMINATED"],
      default: "ACTIVE"
    },

    // Payment history
    paymentHistory: [{
      amount: Number,
      paidDate: Date,
      paymentMonth: String, // e.g., "January 2026"
      status: {
        type: String,
        enum: ["PAID", "PARTIAL", "WAIVED"]
      },
      notes: String
    }],

    // Payment requests from tenant (tenant claims payment, owner verifies)
    paymentRequests: [{
      amount: Number,
      paymentMonth: String, // e.g., "January 2026"
      requestedAt: {
        type: Date,
        default: Date.now
      },
      status: {
        type: String,
        enum: ["PENDING", "VERIFIED", "REJECTED"],
        default: "PENDING"
      },
      paymentMethod: {
        type: String,
        default: "Cash"
      },
      transactionId: String,
      notes: String,
      verifiedAt: Date,
      rejectionReason: String
    }],

    // Reminder tracking
    lastReminderSent: {
      type: Date,
      default: null
    },

    remindersSent: [{
      type: {
        type: String,
        enum: ["5_DAYS_BEFORE", "DUE_DATE", "OVERDUE"]
      },
      sentAt: Date,
      forPaymentDate: Date
    }],

    // Additional terms
    terms: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

// Index for efficient queries
rentAgreementSchema.index({ owner: 1, status: 1 });
rentAgreementSchema.index({ tenant: 1, status: 1 });
rentAgreementSchema.index({ nextPaymentDate: 1, paymentStatus: 1 });

module.exports = mongoose.model("RentAgreement", rentAgreementSchema);
