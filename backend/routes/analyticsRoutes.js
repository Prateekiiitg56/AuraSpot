const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Property = require("../models/Property");
const RentAgreement = require("../models/RentAgreement");
const Maintenance = require("../models/Maintenance");
const Notification = require("../models/Notification");

// Get analytics for an owner
router.get("/owner/:email", async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.params.email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    // Get all properties owned by this user
    const properties = await Property.find({ owner: owner._id });
    const propertyIds = properties.map(p => p._id);

    // ========== RENT ANALYTICS ==========
    const rentAgreements = await RentAgreement.find({
      owner: owner._id,
      status: { $in: ["ACTIVE", "COMPLETED"] }
    });

    // Calculate monthly rent collected (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let monthlyRentCollected = 0;
    let totalRentExpected = 0;
    let pendingPayments = 0;

    for (const agreement of rentAgreements) {
      if (agreement.status === "ACTIVE") {
        totalRentExpected += agreement.rentAmount;
        
        // Check if rent was paid this month - check both paidDate and paidAt
        const paidThisMonth = agreement.paymentHistory?.some(payment => {
          const paymentDate = new Date(payment.paidDate || payment.paidAt);
          return paymentDate >= startOfMonth && paymentDate <= endOfMonth && payment.status === "PAID";
        });

        if (paidThisMonth) {
          monthlyRentCollected += agreement.rentAmount;
        } else {
          // Check if payment is due
          const nextPayment = new Date(agreement.nextPaymentDate);
          if (nextPayment <= now) {
            pendingPayments++;
          }
        }
      }
    }

    // Total rent collected all time
    let totalRentCollected = 0;
    for (const agreement of rentAgreements) {
      if (agreement.paymentHistory) {
        for (const payment of agreement.paymentHistory) {
          if (payment.status === "PAID") {
            totalRentCollected += payment.amount;
          }
        }
      }
    }

    // Last 6 months rent data for chart
    const monthlyRentData = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthName = monthStart.toLocaleString('default', { month: 'short' });

      let collected = 0;
      for (const agreement of rentAgreements) {
        if (agreement.paymentHistory) {
          for (const payment of agreement.paymentHistory) {
            // Check both paidDate and paidAt for compatibility
            const paymentDate = new Date(payment.paidDate || payment.paidAt);
            if (paymentDate >= monthStart && paymentDate <= monthEnd && payment.status === "PAID") {
              collected += payment.amount;
            }
          }
        }
      }

      monthlyRentData.push({ month: monthName, amount: collected });
    }

    // ========== MAINTENANCE ANALYTICS ==========
    const maintenanceRequests = await Maintenance.find({ owner: owner._id });

    const pendingMaintenance = maintenanceRequests.filter(m => m.status === "PENDING").length;
    const approvedMaintenance = maintenanceRequests.filter(m => m.status === "APPROVED").length;
    const inProgressMaintenance = maintenanceRequests.filter(m => m.status === "IN_PROGRESS").length;
    const resolvedMaintenance = maintenanceRequests.filter(m => m.status === "RESOLVED").length;
    const totalMaintenance = maintenanceRequests.length;

    // Average resolution time (for resolved requests)
    let avgResolutionTime = 0;
    const resolvedRequests = maintenanceRequests.filter(m => m.status === "RESOLVED" && m.resolvedDate);
    if (resolvedRequests.length > 0) {
      const totalTime = resolvedRequests.reduce((sum, req) => {
        const created = new Date(req.createdAt);
        const resolved = new Date(req.resolvedDate);
        return sum + (resolved - created);
      }, 0);
      avgResolutionTime = Math.round(totalTime / resolvedRequests.length / (1000 * 60 * 60 * 24)); // days
    }

    // ========== OCCUPANCY ANALYTICS ==========
    const totalProperties = properties.length;
    const occupiedProperties = properties.filter(p => 
      p.status === "BOOKED" || p.status === "SOLD"
    ).length;
    const availableProperties = properties.filter(p => p.status === "AVAILABLE").length;
    const requestedProperties = properties.filter(p => p.status === "REQUESTED").length;

    const occupancyRate = totalProperties > 0 
      ? Math.round((occupiedProperties / totalProperties) * 100) 
      : 0;

    // ========== RESPONSE TIME ANALYTICS ==========
    // Calculate average response time for property requests
    const notifications = await Notification.find({
      to: owner._id,
      action: "REQUEST"
    }).sort({ createdAt: -1 });

    let avgResponseTime = 0;
    let respondedCount = 0;

    // Check how quickly owner responded to requests (property status changed from REQUESTED)
    for (const notif of notifications) {
      if (notif.property) {
        const property = await Property.findById(notif.property);
        if (property && property.status !== "REQUESTED") {
          // Assume response happened when status changed
          // We'll use updatedAt as proxy for response time
          const requestTime = new Date(notif.createdAt);
          const responseTime = new Date(property.updatedAt);
          const diff = responseTime - requestTime;
          
          if (diff > 0 && diff < 7 * 24 * 60 * 60 * 1000) { // Within 7 days
            avgResponseTime += diff;
            respondedCount++;
          }
        }
      }
    }

    if (respondedCount > 0) {
      avgResponseTime = Math.round(avgResponseTime / respondedCount / (1000 * 60 * 60)); // hours
    }

    // Pending requests count
    const pendingRequests = notifications.filter(n => {
      return n.property && properties.find(p => 
        p._id.toString() === n.property.toString() && p.status === "REQUESTED"
      );
    }).length;

    // ========== PROPERTY TYPE BREAKDOWN ==========
    const propertyTypes = {};
    for (const prop of properties) {
      propertyTypes[prop.type] = (propertyTypes[prop.type] || 0) + 1;
    }

    // ========== RESPONSE ==========
    res.json({
      rent: {
        monthlyCollected: monthlyRentCollected,
        monthlyExpected: totalRentExpected,
        totalCollected: totalRentCollected,
        pendingPayments,
        activeAgreements: rentAgreements.filter(a => a.status === "ACTIVE").length,
        monthlyData: monthlyRentData
      },
      maintenance: {
        pending: pendingMaintenance,
        approved: approvedMaintenance,
        inProgress: inProgressMaintenance,
        resolved: resolvedMaintenance,
        total: totalMaintenance,
        avgResolutionDays: avgResolutionTime
      },
      occupancy: {
        total: totalProperties,
        occupied: occupiedProperties,
        available: availableProperties,
        requested: requestedProperties,
        rate: occupancyRate
      },
      response: {
        avgResponseHours: avgResponseTime,
        pendingRequests,
        totalResponded: respondedCount
      },
      propertyTypes
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.status(500).json({ message: "Failed to load analytics" });
  }
});

// Get quick stats for dashboard header
router.get("/quick/:email", async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.params.email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const properties = await Property.find({ owner: owner._id });
    const activeAgreements = await RentAgreement.countDocuments({ 
      owner: owner._id, 
      status: "ACTIVE" 
    });
    const pendingMaintenance = await Maintenance.countDocuments({ 
      owner: owner._id, 
      status: { $in: ["PENDING", "APPROVED", "IN_PROGRESS"] }
    });

    res.json({
      totalProperties: properties.length,
      activeRentals: activeAgreements,
      pendingMaintenance,
      occupiedCount: properties.filter(p => p.status === "BOOKED" || p.status === "SOLD").length
    });

  } catch (err) {
    console.error("QUICK STATS ERROR:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

module.exports = router;
