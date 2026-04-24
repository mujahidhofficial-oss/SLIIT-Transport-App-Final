function createId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const notifications = new Map();

function createNotificationMemory({ userId, type, title, message, meta = {} }) {
  const now = new Date();
  const doc = {
    _id: createId("NTF"),
    userId: String(userId).trim(),
    type: String(type).trim(),
    title: String(title).trim(),
    message: String(message).trim(),
    read: false,
    readAt: null,
    meta: meta && typeof meta === "object" ? meta : {},
    createdAt: now,
    updatedAt: now,
  };
  notifications.set(String(doc._id), doc);
  return doc;
}

function listNotificationsByUserMemory(userId) {
  const uid = String(userId).trim();
  return Array.from(notifications.values())
    .filter((n) => String(n.userId) === uid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function findNotificationByIdMemory(id) {
  return notifications.get(String(id)) || null;
}

function saveNotificationMemory(doc) {
  if (!doc || !doc._id) return null;
  doc.updatedAt = new Date();
  notifications.set(String(doc._id), doc);
  return doc;
}

function deleteNotificationMemory(id) {
  return notifications.delete(String(id));
}

module.exports = {
  createNotificationMemory,
  listNotificationsByUserMemory,
  findNotificationByIdMemory,
  saveNotificationMemory,
  deleteNotificationMemory,
};
