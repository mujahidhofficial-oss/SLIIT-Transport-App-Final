const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { createNotificationMemory } = require("./notificationMemoryStore");

const isDbConnected = () => mongoose.connection?.readyState === 1;

async function createAndEmitNotification(req, input) {
  const payload = {
    userId: String(input?.userId ?? "").trim(),
    type: String(input?.type ?? "general").trim(),
    title: String(input?.title ?? "Notification").trim(),
    message: String(input?.message ?? "").trim(),
    meta: input?.meta && typeof input.meta === "object" ? input.meta : {},
  };
  if (!payload.userId || !payload.message) return null;

  const doc = isDbConnected()
    ? await Notification.create(payload)
    : createNotificationMemory(payload);

  const io = req?.app?.get?.("io");
  if (io) {
    io.emit("notificationCreated", {
      id: String(doc._id),
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      read: !!doc.read,
      createdAt: doc.createdAt,
      meta: payload.meta,
    });
  }
  return doc;
}

module.exports = {
  createAndEmitNotification,
};
