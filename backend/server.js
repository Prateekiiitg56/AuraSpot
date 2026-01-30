require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
const path = require("path");

connectDB();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/auth", require("./routes/authRoutes"));
app.use("/properties", require("./routes/propertyRoutes"));
app.use(express.urlencoded({ extended: true }));
app.use("/users", require("./routes/userRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));
app.use("/chat", require("./routes/chatRoutes"));
app.use("/rent", require("./routes/rentRoutes"));
app.use("/maintenance", require("./routes/maintenanceRoutes"));
app.use("/analytics", require("./routes/analyticsRoutes"));
app.use("/ai", require("./routes/aiRoutes"));

// Daily cron job for rent reminders (runs every hour to check)
const processRentReminders = async () => {
  try {
    const RentAgreement = require("./models/RentAgreement");
    const Notification = require("./models/Notification");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const agreements = await RentAgreement.find({ status: "ACTIVE" })
      .populate("owner tenant property");

    for (const agreement of agreements) {
      const dueDate = new Date(agreement.nextPaymentDate);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      const alreadySent = (type) => agreement.remindersSent?.some(r => 
        r.type === type && new Date(r.forPaymentDate).getTime() === dueDate.getTime()
      );

      let reminderType = null;
      let message = null;

      if (daysUntilDue === 5 && !alreadySent("5_DAYS_BEFORE")) {
        reminderType = "5_DAYS_BEFORE";
        message = `Rent reminder: ₹${agreement.rentAmount} due in 5 days for ${agreement.property?.title}`;
      } else if (daysUntilDue === 0 && !alreadySent("DUE_DATE")) {
        reminderType = "DUE_DATE";
        message = `Rent due today: ₹${agreement.rentAmount} for ${agreement.property?.title}`;
      } else if (daysUntilDue < 0 && agreement.paymentStatus !== "PAID" && !alreadySent("OVERDUE")) {
        reminderType = "OVERDUE";
        message = `OVERDUE: Rent of ₹${agreement.rentAmount} was due ${Math.abs(daysUntilDue)} days ago`;
        agreement.paymentStatus = "OVERDUE";
      }

      if (reminderType && message && agreement.tenant && agreement.owner && agreement.property) {
        await Notification.create({
          from: agreement.owner._id,
          to: agreement.tenant._id,
          property: agreement.property._id,
          action: `RENT_${reminderType}`,
          message
        });
        
        agreement.remindersSent = agreement.remindersSent || [];
        agreement.remindersSent.push({ type: reminderType, sentAt: new Date(), forPaymentDate: dueDate });
        await agreement.save();
        console.log(`[CRON] Sent ${reminderType} reminder for ${agreement.property.title}`);
      }
    }
  } catch (err) {
    console.error("[CRON] Rent reminder error:", err);
  }
};

// Run every hour
setInterval(processRentReminders, 60 * 60 * 1000);
// Also run once on startup (after 10 seconds to let DB connect)
setTimeout(processRentReminders, 10000);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));




