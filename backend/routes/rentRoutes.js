const express = require("express");
const RentAgreement = require("../models/RentAgreement");
const Property = require("../models/Property");
const User = require("../models/User");
const Notification = require("../models/Notification");

const router = express.Router();

/* ================= CREATE RENT AGREEMENT ================= */

router.post("/create", async (req, res) => {
  try {
    const {
      propertyId,
      ownerEmail,
      tenantEmail,
      rentAmount,
      securityDeposit,
      rentalStartDate,
      paymentCycleDay,
      terms
    } = req.body;

    const owner = await User.findOne({ email: ownerEmail });
    const tenant = await User.findOne({ email: tenantEmail });
    const property = await Property.findById(propertyId);

    if (!owner || !tenant || !property) {
      return res.status(400).json({ message: "Invalid owner, tenant, or property" });
    }

    // Calculate first payment date
    const startDate = new Date(rentalStartDate);
    const cycleDay = paymentCycleDay || startDate.getDate();
    
    // Next payment is on the cycle day of next month
    let nextPayment = new Date(startDate);
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    nextPayment.setDate(Math.min(cycleDay, 28)); // Cap at 28 to avoid month issues

    const agreement = await RentAgreement.create({
      property: property._id,
      owner: owner._id,
      tenant: tenant._id,
      rentAmount: rentAmount || property.price,
      securityDeposit: securityDeposit || 0,
      rentalStartDate: startDate,
      nextPaymentDate: nextPayment,
      paymentCycleDay: cycleDay,
      paymentStatus: "PENDING",
      status: "ACTIVE",
      terms: terms || ""
    });

    // Update property status
    property.status = "BOOKED";
    property.assignedTo = tenant._id;
    await property.save();

    // Notify both parties
    await Notification.create({
      from: owner._id,
      to: tenant._id,
      property: property._id,
      action: "RENT_AGREEMENT_CREATED",
      message: `Rent agreement created for ${property.title}. Monthly rent: ₹${rentAmount || property.price}`
    });

    res.json({ success: true, agreement });
  } catch (err) {
    console.error("CREATE RENT AGREEMENT ERROR:", err);
    res.status(500).json({ message: "Failed to create rent agreement" });
  }
});

/* ================= GET OWNER'S RENT AGREEMENTS ================= */

router.get("/owner/:email", async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.params.email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    // Only return ACTIVE agreements (terminated/completed go to history)
    const agreements = await RentAgreement.find({ 
      owner: owner._id,
      status: "ACTIVE"
    })
      .populate("property", "title city area type image price")
      .populate("tenant", "name email")
      .sort({ createdAt: -1 });

    res.json(agreements);
  } catch (err) {
    console.error("GET OWNER AGREEMENTS ERROR:", err);
    res.status(500).json({ message: "Failed to load agreements" });
  }
});

/* ================= GET TENANT'S RENT AGREEMENTS ================= */

router.get("/tenant/:email", async (req, res) => {
  try {
    const tenant = await User.findOne({ email: req.params.email });
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Only return ACTIVE agreements (terminated/completed go to history)
    const agreements = await RentAgreement.find({ 
      tenant: tenant._id,
      status: "ACTIVE"
    })
      .populate("property", "title city area type image price")
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json(agreements);
  } catch (err) {
    console.error("GET TENANT AGREEMENTS ERROR:", err);
    res.status(500).json({ message: "Failed to load agreements" });
  }
});

/* ================= GET SINGLE AGREEMENT ================= */

router.get("/:id", async (req, res) => {
  try {
    const agreement = await RentAgreement.findById(req.params.id)
      .populate("property", "title city area type image price amenities description")
      .populate("owner", "name email")
      .populate("tenant", "name email");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    res.json(agreement);
  } catch (err) {
    console.error("GET AGREEMENT ERROR:", err);
    res.status(500).json({ message: "Failed to load agreement" });
  }
});

/* ================= MARK PAYMENT AS PAID ================= */

router.post("/:id/pay", async (req, res) => {
  try {
    const { amount, notes, ownerEmail } = req.body;
    
    const agreement = await RentAgreement.findById(req.params.id)
      .populate("owner")
      .populate("tenant")
      .populate("property");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    // Verify owner
    if (agreement.owner.email !== ownerEmail) {
      return res.status(403).json({ message: "Only owner can mark payment as received" });
    }

    // Add to payment history
    const paymentMonth = new Date(agreement.nextPaymentDate).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });

    agreement.paymentHistory.push({
      amount: amount || agreement.rentAmount,
      paidDate: new Date(),
      paymentMonth,
      status: "PAID",
      notes: notes || ""
    });

    // Update next payment date (add 30 days)
    const nextDate = new Date(agreement.nextPaymentDate);
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(Math.min(agreement.paymentCycleDay, 28));
    
    agreement.nextPaymentDate = nextDate;
    agreement.paymentStatus = "PENDING"; // Reset for next cycle
    agreement.lastReminderSent = null; // Reset reminders

    await agreement.save();

    // Notify tenant
    await Notification.create({
      from: agreement.owner._id,
      to: agreement.tenant._id,
      property: agreement.property._id,
      action: "PAYMENT_CONFIRMED",
      message: `Payment of ₹${amount || agreement.rentAmount} confirmed for ${paymentMonth}`
    });

    res.json({ success: true, agreement });
  } catch (err) {
    console.error("MARK PAYMENT ERROR:", err);
    res.status(500).json({ message: "Failed to mark payment" });
  }
});

/* ================= TENANT REQUESTS PAYMENT VERIFICATION ================= */

router.post("/:id/request-payment", async (req, res) => {
  try {
    const { tenantEmail, amount, paymentMonth, paymentMethod, transactionId, notes } = req.body;

    const agreement = await RentAgreement.findById(req.params.id)
      .populate("owner")
      .populate("tenant")
      .populate("property");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (agreement.tenant.email !== tenantEmail) {
      return res.status(403).json({ message: "Only tenant can request payment verification" });
    }

    // Check if there's already a pending request for this month
    const existingRequest = agreement.paymentRequests?.find(
      r => r.paymentMonth === paymentMonth && r.status === "PENDING"
    );

    if (existingRequest) {
      return res.status(400).json({ message: "A payment request for this month is already pending" });
    }

    // Add payment request
    if (!agreement.paymentRequests) {
      agreement.paymentRequests = [];
    }

    agreement.paymentRequests.push({
      amount: amount || agreement.rentAmount,
      paymentMonth,
      paymentMethod: paymentMethod || "Cash",
      transactionId: transactionId || "",
      notes: notes || "",
      requestedAt: new Date(),
      status: "PENDING"
    });

    await agreement.save();

    // Notify owner about the payment request
    await Notification.create({
      from: agreement.tenant._id,
      to: agreement.owner._id,
      property: agreement.property._id,
      action: "PAYMENT_REQUEST",
      message: `${agreement.tenant.name} claims to have paid ₹${amount || agreement.rentAmount} for ${paymentMonth}. Please verify.`
    });

    res.json({ success: true, message: "Payment verification request sent to owner", agreement });
  } catch (err) {
    console.error("REQUEST PAYMENT ERROR:", err);
    res.status(500).json({ message: "Failed to request payment verification" });
  }
});

/* ================= OWNER VERIFIES PAYMENT REQUEST ================= */

router.post("/:id/verify-payment", async (req, res) => {
  try {
    const { ownerEmail, requestIndex, action, rejectionReason } = req.body;

    const agreement = await RentAgreement.findById(req.params.id)
      .populate("owner")
      .populate("tenant")
      .populate("property");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (agreement.owner.email !== ownerEmail) {
      return res.status(403).json({ message: "Only owner can verify payments" });
    }

    if (!agreement.paymentRequests || !agreement.paymentRequests[requestIndex]) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    const request = agreement.paymentRequests[requestIndex];

    if (request.status !== "PENDING") {
      return res.status(400).json({ message: "This request has already been processed" });
    }

    if (action === "VERIFY") {
      // Mark request as verified
      agreement.paymentRequests[requestIndex].status = "VERIFIED";
      agreement.paymentRequests[requestIndex].verifiedAt = new Date();

      // Add to payment history
      agreement.paymentHistory.push({
        amount: request.amount,
        paidDate: new Date(),
        paymentMonth: request.paymentMonth,
        status: "PAID",
        notes: `Verified. Method: ${request.paymentMethod}. ${request.transactionId ? `TxnID: ${request.transactionId}` : ""}`
      });

      // Update next payment date
      const nextDate = new Date(agreement.nextPaymentDate);
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(Math.min(agreement.paymentCycleDay, 28));
      agreement.nextPaymentDate = nextDate;
      agreement.paymentStatus = "PENDING";
      agreement.lastReminderSent = null;

      await agreement.save();

      // Notify tenant
      await Notification.create({
        from: agreement.owner._id,
        to: agreement.tenant._id,
        property: agreement.property._id,
        action: "PAYMENT_VERIFIED",
        message: `Your payment of ₹${request.amount} for ${request.paymentMonth} has been verified by the owner.`
      });

      res.json({ success: true, message: "Payment verified successfully", agreement });
    } else if (action === "REJECT") {
      // Mark request as rejected
      agreement.paymentRequests[requestIndex].status = "REJECTED";
      agreement.paymentRequests[requestIndex].rejectionReason = rejectionReason || "Payment could not be verified";

      await agreement.save();

      // Notify tenant
      await Notification.create({
        from: agreement.owner._id,
        to: agreement.tenant._id,
        property: agreement.property._id,
        action: "PAYMENT_REJECTED",
        message: `Your payment claim for ${request.paymentMonth} was not verified. Reason: ${rejectionReason || "Payment could not be verified"}`
      });

      res.json({ success: true, message: "Payment request rejected", agreement });
    } else {
      return res.status(400).json({ message: "Invalid action. Use VERIFY or REJECT" });
    }
  } catch (err) {
    console.error("VERIFY PAYMENT ERROR:", err);
    res.status(500).json({ message: "Failed to verify payment" });
  }
});

/* ================= GET PENDING PAYMENT REQUESTS ================= */

router.get("/:id/payment-requests", async (req, res) => {
  try {
    const agreement = await RentAgreement.findById(req.params.id)
      .populate("tenant", "name email");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    const pendingRequests = agreement.paymentRequests?.filter(r => r.status === "PENDING") || [];

    res.json({ success: true, requests: pendingRequests, allRequests: agreement.paymentRequests || [] });
  } catch (err) {
    console.error("GET PAYMENT REQUESTS ERROR:", err);
    res.status(500).json({ message: "Failed to get payment requests" });
  }
});

/* ================= UPDATE PAYMENT STATUS ================= */

router.put("/:id/status", async (req, res) => {
  try {
    const { paymentStatus, ownerEmail } = req.body;
    
    const agreement = await RentAgreement.findById(req.params.id)
      .populate("owner");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (agreement.owner.email !== ownerEmail) {
      return res.status(403).json({ message: "Only owner can update status" });
    }

    agreement.paymentStatus = paymentStatus;
    await agreement.save();

    res.json({ success: true, agreement });
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/* ================= TERMINATE AGREEMENT ================= */

router.post("/:id/terminate", async (req, res) => {
  try {
    const { ownerEmail, reason } = req.body;
    
    const agreement = await RentAgreement.findById(req.params.id)
      .populate("owner")
      .populate("tenant")
      .populate("property");

    if (!agreement) {
      return res.status(404).json({ message: "Agreement not found" });
    }

    if (agreement.owner.email !== ownerEmail) {
      return res.status(403).json({ message: "Only owner can terminate agreement" });
    }

    agreement.status = "TERMINATED";
    agreement.rentalEndDate = new Date();
    await agreement.save();

    // Update property status back to available
    const property = await Property.findById(agreement.property._id);
    if (property) {
      property.status = "AVAILABLE";
      property.assignedTo = null;
      await property.save();
    }

    // Notify tenant
    await Notification.create({
      from: agreement.owner._id,
      to: agreement.tenant._id,
      property: agreement.property._id,
      action: "AGREEMENT_TERMINATED",
      message: `Rent agreement for ${agreement.property.title} has been terminated. ${reason || ""}`
    });

    res.json({ success: true, agreement });
  } catch (err) {
    console.error("TERMINATE ERROR:", err);
    res.status(500).json({ message: "Failed to terminate agreement" });
  }
});

/* ================= PROCESS RENT REMINDERS (CRON ENDPOINT) ================= */

router.post("/process-reminders", async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agreements = await RentAgreement.find({ 
      status: "ACTIVE" 
    }).populate("owner tenant property");

    let remindersProcessed = 0;

    for (const agreement of agreements) {
      const dueDate = new Date(agreement.nextPaymentDate);
      dueDate.setHours(0, 0, 0, 0);
      
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      // Check if reminder already sent for this payment date
      const alreadySent = (type) => {
        return agreement.remindersSent.some(r => 
          r.type === type && 
          new Date(r.forPaymentDate).getTime() === dueDate.getTime()
        );
      };

      let reminderType = null;
      let message = null;

      // 5 days before due
      if (daysUntilDue === 5 && !alreadySent("5_DAYS_BEFORE")) {
        reminderType = "5_DAYS_BEFORE";
        message = `Rent reminder: ₹${agreement.rentAmount} due in 5 days for ${agreement.property.title}`;
      }
      // On due date
      else if (daysUntilDue === 0 && !alreadySent("DUE_DATE")) {
        reminderType = "DUE_DATE";
        message = `Rent due today: ₹${agreement.rentAmount} for ${agreement.property.title}`;
        agreement.paymentStatus = "PENDING";
      }
      // Overdue
      else if (daysUntilDue < 0 && !alreadySent("OVERDUE")) {
        reminderType = "OVERDUE";
        message = `OVERDUE: Rent of ₹${agreement.rentAmount} was due ${Math.abs(daysUntilDue)} days ago for ${agreement.property.title}`;
        agreement.paymentStatus = "OVERDUE";
      }

      if (reminderType && message) {
        // Send to tenant
        await Notification.create({
          from: agreement.owner._id,
          to: agreement.tenant._id,
          property: agreement.property._id,
          action: `RENT_${reminderType}`,
          message
        });

        // Send to owner
        await Notification.create({
          from: agreement.tenant._id,
          to: agreement.owner._id,
          property: agreement.property._id,
          action: `RENT_${reminderType}`,
          message: `${agreement.tenant.name}'s ${message}`
        });

        agreement.remindersSent.push({
          type: reminderType,
          sentAt: new Date(),
          forPaymentDate: dueDate
        });

        agreement.lastReminderSent = new Date();
        await agreement.save();
        remindersProcessed++;
      }
    }

    res.json({ 
      success: true, 
      processed: remindersProcessed,
      totalAgreements: agreements.length
    });
  } catch (err) {
    console.error("PROCESS REMINDERS ERROR:", err);
    res.status(500).json({ message: "Failed to process reminders" });
  }
});

/* ================= GET AGREEMENT BY PROPERTY ================= */

router.get("/property/:propertyId", async (req, res) => {
  try {
    const agreement = await RentAgreement.findOne({ 
      property: req.params.propertyId,
      status: "ACTIVE"
    })
      .populate("property", "title city area type image price")
      .populate("owner", "name email")
      .populate("tenant", "name email");

    res.json(agreement || null);
  } catch (err) {
    console.error("GET AGREEMENT BY PROPERTY ERROR:", err);
    res.status(500).json({ message: "Failed to load agreement" });
  }
});

/* ================= GET RENTAL HISTORY (terminated/completed agreements) ================= */

router.get("/history/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get agreements where user is either owner or tenant, and status is TERMINATED or COMPLETED
    const history = await RentAgreement.find({
      $or: [
        { owner: user._id },
        { tenant: user._id }
      ],
      status: { $in: ["TERMINATED", "COMPLETED"] }
    })
      .populate("property", "title type city area price images image")
      .populate("owner", "name email")
      .populate("tenant", "name email")
      .sort({ rentalEndDate: -1 }); // Most recent first

    // Add role info (whether user was owner or tenant)
    const historyWithRole = history.map(agreement => {
      const agreementObj = agreement.toObject();
      agreementObj.userRole = agreement.owner._id.toString() === user._id.toString() ? "OWNER" : "TENANT";
      
      // Calculate duration
      if (agreement.rentalStartDate && agreement.rentalEndDate) {
        const start = new Date(agreement.rentalStartDate);
        const end = new Date(agreement.rentalEndDate);
        const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30));
        agreementObj.durationMonths = months;
      }
      
      // Calculate total payments
      agreementObj.totalPayments = agreement.paymentHistory?.length || 0;
      agreementObj.totalAmountPaid = agreement.paymentHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
      
      return agreementObj;
    });

    res.json(historyWithRole);
  } catch (err) {
    console.error("GET RENTAL HISTORY ERROR:", err);
    res.status(500).json({ message: "Failed to load rental history" });
  }
});

/* ================= GET BOOKED PROPERTIES WITHOUT AGREEMENTS (for manual adding) ================= */

router.get("/pending-properties/:email", async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.params.email });
    if (!owner) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get owner's BOOKED properties for RENT
    const bookedProperties = await Property.find({
      owner: owner._id,
      status: "BOOKED",
      purpose: "RENT"
    }).populate("assignedTo", "name email");

    // Get existing active agreements for these properties
    const existingAgreements = await RentAgreement.find({
      owner: owner._id,
      status: "ACTIVE"
    }).select("property");

    const agreementPropertyIds = existingAgreements.map(a => a.property.toString());

    // Filter out properties that already have agreements
    const pendingProperties = bookedProperties.filter(
      prop => !agreementPropertyIds.includes(prop._id.toString())
    );

    res.json(pendingProperties);
  } catch (err) {
    console.error("GET PENDING PROPERTIES ERROR:", err);
    res.status(500).json({ message: "Failed to load pending properties" });
  }
});

module.exports = router;
