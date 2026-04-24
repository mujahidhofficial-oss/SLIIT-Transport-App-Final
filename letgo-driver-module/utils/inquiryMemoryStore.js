function createId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const inquiries = new Map();

function createInquiryMemory({ studentId, tripId = null, message }) {
  const now = new Date();
  const inquiry = {
    _id: createId("INQ"),
    studentId: String(studentId).trim(),
    tripId: tripId || null,
    message: String(message).trim(),
    status: "open",
    response: "",
    respondedBy: "",
    respondedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  inquiries.set(String(inquiry._id), inquiry);
  return inquiry;
}

function findInquiryByIdMemory(id) {
  return inquiries.get(String(id)) || null;
}

function updateInquiryMemory(id, patch = {}) {
  const inquiry = findInquiryByIdMemory(id);
  if (!inquiry) return null;
  Object.assign(inquiry, patch, { updatedAt: new Date() });
  inquiries.set(String(inquiry._id), inquiry);
  return inquiry;
}

module.exports = {
  createInquiryMemory,
  findInquiryByIdMemory,
  updateInquiryMemory,
};
