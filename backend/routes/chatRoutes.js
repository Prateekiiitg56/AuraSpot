const express = require("express");
const router = express.Router();
const Chat = require("../models/Chat");
const User = require("../models/User");
const Property = require("../models/Property");
const Notification = require("../models/Notification");

// Send a message
router.post("/", async (req, res) => {
  try {
    const { propertyId, senderEmail, receiverEmail, message } = req.body;

    if (!propertyId || !senderEmail || !receiverEmail || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find sender and receiver by email
    const sender = await User.findOne({ email: senderEmail });
    const receiver = await User.findOne({ email: receiverEmail });

    if (!sender || !receiver) {
      return res.status(404).json({ message: "Sender or receiver not found" });
    }

    // Verify property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    const chat = new Chat({
      property: propertyId,
      sender: sender._id,
      receiver: receiver._id,
      message
    });

    await chat.save();
    
    // Delete message notifications for this property between these two users
    // (removes the notification that prompted this reply)
    try {
      await Notification.deleteMany({
        property: propertyId,
        action: "MESSAGE",
        $or: [
          { from: sender._id, to: receiver._id },
          { from: receiver._id, to: sender._id }
        ]
      });
    } catch (notifErr) {
      // Silent fail for notification cleanup
    }
    
    // Create notification for receiver that they got a message
    try {
      await Notification.create({
        from: sender._id,
        to: receiver._id,
        property: propertyId,
        action: "MESSAGE",
        message: `New message from ${sender.name || sender.email} about ${property.title}`
      });
    } catch (notifErr) {
      // Silent fail for notification
    }
    
    const populatedChat = await Chat.findById(chat._id)
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .populate("property", "title location price");

    res.status(201).json(populatedChat);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Get all messages for a property between two specific users
router.get("/property/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { userEmail, otherUserEmail } = req.query;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let query = {
      property: propertyId,
      $or: [{ sender: user._id }, { receiver: user._id }]
    };

    // If otherUserEmail is provided, filter to only show conversation with that user
    if (otherUserEmail) {
      const otherUser = await User.findOne({ email: otherUserEmail });
      if (otherUser) {
        query = {
          property: propertyId,
          $or: [
            { sender: user._id, receiver: otherUser._id },
            { sender: otherUser._id, receiver: user._id }
          ]
        };
      }
    }

    // Get all messages for this property where user is either sender or receiver
    const messages = await Chat.find(query)
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .populate("property", "title location price")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

// Get all conversation threads for a property (for owner to see all users who messaged)
router.get("/threads/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { ownerEmail } = req.query;

    if (!ownerEmail) {
      return res.status(400).json({ message: "Owner email is required" });
    }

    const owner = await User.findOne({ email: ownerEmail });
    if (!owner) {
      return res.status(404).json({ message: "Owner not found" });
    }

    // Get all messages for this property where owner is involved
    const messages = await Chat.find({
      property: propertyId,
      $or: [{ sender: owner._id }, { receiver: owner._id }]
    })
      .populate("sender", "name email")
      .populate("receiver", "name email")
      .sort({ createdAt: -1 });

    // Group messages by the other user (not owner)
    const threads = {};
    messages.forEach(msg => {
      const otherUser = msg.sender.email === ownerEmail ? msg.receiver : msg.sender;
      const otherEmail = otherUser.email;
      
      if (!threads[otherEmail]) {
        threads[otherEmail] = {
          user: otherUser,
          lastMessage: msg.message,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
          messageCount: 0
        };
      }
      threads[otherEmail].messageCount++;
      if (!msg.read && msg.receiver.email === ownerEmail) {
        threads[otherEmail].unreadCount++;
      }
    });

    // Convert to array
    const threadArray = Object.values(threads);

    res.json(threadArray);
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ message: "Failed to fetch threads" });
  }
});

// Mark messages as read
router.put("/read/:propertyId", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { userEmail } = req.body;

    if (!userEmail) {
      return res.status(400).json({ message: "User email is required" });
    }

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Mark all messages where user is receiver as read
    await Chat.updateMany(
      { property: propertyId, receiver: user._id, read: false },
      { read: true }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ message: "Failed to mark messages as read" });
  }
});

// Get unread message count for a user
router.get("/unread/:userEmail", async (req, res) => {
  try {
    const { userEmail } = req.params;

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const unreadCount = await Chat.countDocuments({
      receiver: user._id,
      read: false
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ message: "Failed to fetch unread count" });
  }
});

module.exports = router;
