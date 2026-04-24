const Inquiry = require("../models/Inquiry");
const mongoose = require("mongoose");
const {
  createInquiryMemory,
  findInquiryByIdMemory,
  updateInquiryMemory,
} = require("../utils/inquiryMemoryStore");

const isDbConnected = () => mongoose.connection?.readyState === 1;

const createInquiry = async (req, res) => {
  try {
    const { studentId, tripId, message } = req.body;
    if (!studentId || !message) return res.status(400).json({ message: "studentId and message are required" });

    const inquiry = isDbConnected()
      ? await Inquiry.create({
          studentId: String(studentId).trim(),
          tripId: tripId || null,
          message,
          status: "open",
          response: "",
        })
      : createInquiryMemory({
          studentId: String(studentId).trim(),
          tripId: tripId || null,
          message: String(message),
        });

    res.status(201).json({ message: "Inquiry created", inquiry });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getInquiry = async (req, res) => {
  try {
    const inquiry = isDbConnected() ? await Inquiry.findById(req.params.id) : findInquiryByIdMemory(req.params.id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });
    res.json(inquiry);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const respondInquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { response, status = "resolved" } = req.body;

    const inquiry = isDbConnected() ? await Inquiry.findById(id) : findInquiryByIdMemory(id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    if (isDbConnected()) {
      inquiry.response = response || "";
      inquiry.status = status;
      inquiry.respondedBy = "admin_demo";
      inquiry.respondedAt = new Date();
      await inquiry.save();
    } else {
      updateInquiryMemory(id, {
        response: response || "",
        status,
        respondedBy: "admin_demo",
        respondedAt: new Date(),
      });
    }
    res.json({ message: "Inquiry updated", inquiry });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { createInquiry, getInquiry, respondInquiry };

