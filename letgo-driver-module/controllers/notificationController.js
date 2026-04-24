const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const {
  createNotificationMemory,
  listNotificationsByUserMemory,
  findNotificationByIdMemory,
  saveNotificationMemory,
  deleteNotificationMemory,
} = require("../utils/notificationMemoryStore");
const { createAndEmitNotification } = require("../utils/notify");

const isDbConnected = () => mongoose.connection?.readyState === 1;

async function createNotification(req, res) {
  try {
    const { userId, type = "general", title = "Notification", message, meta = {} } = req.body || {};
    if (!userId || !message) {
      return res.status(400).json({ message: "userId and message are required" });
    }
    const doc = await createAndEmitNotification(req, { userId, type, title, message, meta });
    return res.status(201).json({ message: "Notification created", notification: doc });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function getUserNotifications(req, res) {
  try {
    const userId = String(req.query.userId || "").trim();
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const items = isDbConnected()
      ? await Notification.find({ userId }).sort({ createdAt: -1 }).limit(200)
      : listNotificationsByUserMemory(userId);
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    let doc = null;
    if (isDbConnected()) {
      doc = await Notification.findById(id);
      if (!doc) return res.status(404).json({ message: "Notification not found" });
      doc.read = true;
      doc.readAt = new Date();
      await doc.save();
    } else {
      doc = findNotificationByIdMemory(id);
      if (!doc) return res.status(404).json({ message: "Notification not found" });
      doc.read = true;
      doc.readAt = new Date();
      saveNotificationMemory(doc);
    }
    return res.json({ message: "Notification marked as read", notification: doc });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    if (isDbConnected()) {
      const deleted = await Notification.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ message: "Notification not found" });
    } else {
      const ok = deleteNotificationMemory(id);
      if (!ok) return res.status(404).json({ message: "Notification not found" });
    }
    return res.json({ message: "Notification deleted" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

module.exports = {
  createNotification,
  getUserNotifications,
  markNotificationRead,
  deleteNotification,
};
