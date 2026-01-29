const express = require("express");
const router = express.Router();
const Maintenance = require("../models/Maintenance");
const User = require("../models/User");
const Property = require("../models/Property");
const Notification = require("../models/Notification");

// Create maintenance request (tenant only)
router.post("/", async (req, res) => {
  try {
    const { propertyId, tenantEmail, category, title, description, priority, images } = req.body;

    if (!propertyId || !tenantEmail || !category || !title || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const tenant = await User.findOne({ email: tenantEmail });
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const property = await Property.findById(propertyId).populate("owner");
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Verify tenant is assigned to this property
    if (!property.assignedTo || property.assignedTo.toString() !== tenant._id.toString()) {
      return res.status(403).json({ message: "You are not a tenant of this property" });
    }

    const maintenance = await Maintenance.create({
      property: propertyId,
      tenant: tenant._id,
      owner: property.owner._id,
      category,
      title,
      description,
      priority: priority || "MEDIUM",
      images: images || [],
      updates: [{
        message: `Maintenance request created: ${title}`,
        by: tenant._id,
        role: "TENANT"
      }]
    });

    // Notify owner
    await Notification.create({
      from: tenant._id,
      to: property.owner._id,
      property: propertyId,
      action: "MAINTENANCE_REQUEST",
      message: `New maintenance request: ${title} - ${category} (${priority || "MEDIUM"} priority)`
    });

    const populated = await Maintenance.findById(maintenance._id)
      .populate("property", "title city area image")
      .populate("tenant", "name email")
      .populate("owner", "name email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("CREATE MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to create maintenance request" });
  }
});

// Get all maintenance requests for a tenant
router.get("/tenant/:email", async (req, res) => {
  try {
    const tenant = await User.findOne({ email: req.params.email });
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const requests = await Maintenance.find({ tenant: tenant._id })
      .populate("property", "title city area image")
      .populate("owner", "name email phone")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("GET TENANT MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to load maintenance requests" });
  }
});

// Get all maintenance requests for an owner
router.get("/owner/:email", async (req, res) => {
  try {
    const owner = await User.findOne({ email: req.params.email });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const requests = await Maintenance.find({ owner: owner._id })
      .populate("property", "title city area image")
      .populate("tenant", "name email phone")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("GET OWNER MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to load maintenance requests" });
  }
});

// Get maintenance requests for a specific property
router.get("/property/:propertyId", async (req, res) => {
  try {
    const requests = await Maintenance.find({ property: req.params.propertyId })
      .populate("tenant", "name email")
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("GET PROPERTY MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to load maintenance requests" });
  }
});

// Get single maintenance request
router.get("/:id", async (req, res) => {
  try {
    const request = await Maintenance.findById(req.params.id)
      .populate("property", "title city area image price")
      .populate("tenant", "name email phone")
      .populate("owner", "name email phone")
      .populate("updates.by", "name email");

    if (!request) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    res.json(request);
  } catch (err) {
    console.error("GET MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to load maintenance request" });
  }
});

// Update maintenance status (owner only)
router.put("/:id/status", async (req, res) => {
  try {
    const { status, ownerEmail, message } = req.body;

    const owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    if (maintenance.owner.toString() !== owner._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const oldStatus = maintenance.status;
    maintenance.status = status;

    if (status === "RESOLVED") {
      maintenance.resolvedDate = new Date();
    }

    // Add update to history
    maintenance.updates.push({
      message: message || `Status changed from ${oldStatus} to ${status}`,
      by: owner._id,
      role: "OWNER"
    });

    await maintenance.save();

    // Notify tenant
    await Notification.create({
      from: owner._id,
      to: maintenance.tenant,
      property: maintenance.property,
      action: "MAINTENANCE_UPDATE",
      message: `Maintenance request "${maintenance.title}" status: ${status}`
    });

    const populated = await Maintenance.findById(maintenance._id)
      .populate("property", "title city area image")
      .populate("tenant", "name email")
      .populate("owner", "name email");

    res.json(populated);
  } catch (err) {
    console.error("UPDATE STATUS ERROR:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

// Assign worker (owner only)
router.put("/:id/assign-worker", async (req, res) => {
  try {
    const { ownerEmail, workerName, workerPhone, workerSpecialty, scheduledDate, estimatedCost } = req.body;

    const owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    if (maintenance.owner.toString() !== owner._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    maintenance.assignedWorker = {
      name: workerName || "",
      phone: workerPhone || "",
      specialty: workerSpecialty || ""
    };

    if (scheduledDate) {
      maintenance.scheduledDate = new Date(scheduledDate);
    }

    if (estimatedCost) {
      maintenance.estimatedCost = estimatedCost;
    }

    if (maintenance.status === "PENDING" || maintenance.status === "APPROVED") {
      maintenance.status = "IN_PROGRESS";
    }

    maintenance.updates.push({
      message: `Worker assigned: ${workerName} (${workerSpecialty})${scheduledDate ? ` - Scheduled for ${new Date(scheduledDate).toLocaleDateString()}` : ""}`,
      by: owner._id,
      role: "OWNER"
    });

    await maintenance.save();

    // Notify tenant
    await Notification.create({
      from: owner._id,
      to: maintenance.tenant,
      property: maintenance.property,
      action: "MAINTENANCE_UPDATE",
      message: `Worker assigned for "${maintenance.title}": ${workerName} (${workerSpecialty})`
    });

    const populated = await Maintenance.findById(maintenance._id)
      .populate("property", "title city area image")
      .populate("tenant", "name email")
      .populate("owner", "name email");

    res.json(populated);
  } catch (err) {
    console.error("ASSIGN WORKER ERROR:", err);
    res.status(500).json({ message: "Failed to assign worker" });
  }
});

// Add comment/update (tenant or owner)
router.post("/:id/comment", async (req, res) => {
  try {
    const { userEmail, message, role } = req.body;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    maintenance.updates.push({
      message,
      by: user._id,
      role: role || "TENANT"
    });

    await maintenance.save();

    // Notify the other party
    const notifyTo = role === "OWNER" ? maintenance.tenant : maintenance.owner;
    await Notification.create({
      from: user._id,
      to: notifyTo,
      property: maintenance.property,
      action: "MAINTENANCE_COMMENT",
      message: `New comment on "${maintenance.title}": ${message.substring(0, 50)}...`
    });

    const populated = await Maintenance.findById(maintenance._id)
      .populate("property", "title city area image")
      .populate("tenant", "name email")
      .populate("owner", "name email")
      .populate("updates.by", "name email");

    res.json(populated);
  } catch (err) {
    console.error("ADD COMMENT ERROR:", err);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// Rate resolved maintenance (tenant only)
router.put("/:id/rate", async (req, res) => {
  try {
    const { tenantEmail, rating, feedback } = req.body;

    const tenant = await User.findOne({ email: tenantEmail });
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const maintenance = await Maintenance.findById(req.params.id);
    if (!maintenance) {
      return res.status(404).json({ message: "Maintenance request not found" });
    }

    if (maintenance.tenant.toString() !== tenant._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (maintenance.status !== "RESOLVED") {
      return res.status(400).json({ message: "Can only rate resolved requests" });
    }

    maintenance.rating = rating;
    maintenance.ratingFeedback = feedback || "";

    await maintenance.save();

    res.json({ message: "Rating submitted successfully", maintenance });
  } catch (err) {
    console.error("RATE MAINTENANCE ERROR:", err);
    res.status(500).json({ message: "Failed to submit rating" });
  }
});

// Get maintenance stats for a user
router.get("/stats/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const asTenant = await Maintenance.aggregate([
      { $match: { tenant: user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const asOwner = await Maintenance.aggregate([
      { $match: { owner: user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    res.json({
      asTenant: asTenant.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      asOwner: asOwner.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {})
    });
  } catch (err) {
    console.error("GET STATS ERROR:", err);
    res.status(500).json({ message: "Failed to load stats" });
  }
});

module.exports = router;
