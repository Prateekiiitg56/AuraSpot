const router = require("express").Router();
const Notification = require("../models/Notification");
const User = require("../models/User");


/* ================= CREATE REQUEST ================= */

router.post("/", async (req, res) => {
  try {
    const { from, ownerId, propertyId, action, message } = req.body;

    if (!from || !ownerId || !propertyId)
      return res.status(400).json({ message: "Missing data" });

    const fromUser = await User.findOne({ email: from });
    const toUser = await User.findById(ownerId);

    if (!fromUser || !toUser)
      return res.status(404).json({ message: "User not found" });

    const notif = await Notification.create({
      from: fromUser._id,
      to: toUser._id,
      property: propertyId,
      action,
      message: message || ""
    });

    res.status(201).json(notif);
  } catch (err) {
    console.error("NOTIFICATION CREATE ERROR:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
});


/* ================= OWNER INBOX ================= */

router.get("/owner/:ownerId", async (req, res) => {
  try {
    const notes = await Notification.find({
      to: req.params.ownerId,
      action: { $in: ["RENT", "BUY"] } // Only show rent/buy requests
    })
      .populate("from", "name email")
      .populate("property", "title price status owner assignedTo")
      .sort({ createdAt: -1 });

    // Filter out notifications where property is null or already BOOKED/SOLD
    const activeNotes = notes.filter(
      note => note.property && note.property.status !== "BOOKED" && note.property.status !== "SOLD"
    );

    res.json(activeNotes);
  } catch (err) {
    console.error("LOAD OWNER NOTES ERROR:", err);
    res.status(500).json({ message: "Failed loading notifications" });
  }
});


/* ================= CHECK IF USER ALREADY REQUESTED ================= */

router.get("/check-request/:propertyId/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.json({ hasRequested: false });
    }

    const existingRequest = await Notification.findOne({
      from: user._id,
      property: req.params.propertyId,
      action: { $in: ["RENT", "BUY"] }
    });

    res.json({ hasRequested: !!existingRequest });
  } catch (err) {
    console.error("CHECK REQUEST ERROR:", err);
    res.json({ hasRequested: false });
  }
});


/* ================= SENDER HISTORY ================= */

router.get("/sender/:userId", async (req, res) => {
  try {
    const notes = await Notification.find({
      from: req.params.userId
    })
      .populate("to", "name email")
      .populate("property", "title price status")
      .sort({ createdAt: -1 });

    res.json(notes);
  } catch (err) {
    console.error("LOAD SENDER NOTES ERROR:", err);
    res.status(500).json({ message: "Failed loading notifications" });
  }
});

/* ================= USER NOTIFICATIONS (INCLUDING ACCEPTANCES) ================= */

router.get("/user/:userEmail", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.userEmail });
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const notes = await Notification.find({
      to: user._id
    })
      .populate("from", "name email")
      .populate("property")
      .sort({ createdAt: -1 });

    res.json(notes);
  } catch (err) {
    console.error("LOAD USER NOTES ERROR:", err);
    res.status(500).json({ message: "Failed loading notifications" });
  }
});

/* ================= CLEANUP ORPHANED NOTIFICATIONS ================= */

router.delete("/cleanup/orphaned", async (req, res) => {
  try {
    const Property = require("../models/Property");
    
    // Get all notifications
    const allNotifications = await Notification.find({});
    
    let deletedCount = 0;
    
    for (const notif of allNotifications) {
      if (notif.property) {
        // Check if property still exists
        const propertyExists = await Property.findById(notif.property);
        if (!propertyExists) {
          await Notification.findByIdAndDelete(notif._id);
          deletedCount++;
        }
      } else {
        // No property reference, delete it
        await Notification.findByIdAndDelete(notif._id);
        deletedCount++;
      }
    }
    
    res.json({ 
      message: `Cleanup complete. Deleted ${deletedCount} orphaned notifications.`,
      deletedCount 
    });
  } catch (err) {
    console.error("CLEANUP ERROR:", err);
    res.status(500).json({ message: "Failed to cleanup notifications" });
  }
});

/* ================= DELETE SINGLE NOTIFICATION ================= */

router.delete("/:id", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await Notification.findByIdAndDelete(req.params.id);
    
    res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    console.error("DELETE NOTIFICATION ERROR:", err);
    res.status(500).json({ message: "Failed to delete notification" });
  }
});

/* ================= REJECT REQUEST ================= */

router.post("/reject/:notificationId", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId)
      .populate("from", "name email")
      .populate("to", "name email")
      .populate("property", "title");
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Create rejection notification for the requester
    await Notification.create({
      from: notification.to._id, // Owner
      to: notification.from._id, // Requester
      property: notification.property._id,
      action: "REJECTED",
      message: `Your request for ${notification.property?.title || "the property"} has been declined by the owner.`
    });

    // Delete the original request notification
    await Notification.findByIdAndDelete(req.params.notificationId);
    
    res.json({ message: "Request rejected successfully" });
  } catch (err) {
    console.error("REJECT REQUEST ERROR:", err);
    res.status(500).json({ message: "Failed to reject request" });
  }
});

module.exports = router;
