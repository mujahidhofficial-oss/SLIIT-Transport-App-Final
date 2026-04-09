const Inquiry = require("../models/Inquiry");

const createInquiry = async (req, res) => {
  try {
    const { studentId, tripId, message } = req.body;
    if (!studentId || !message) return res.status(400).json({ message: "studentId and message are required" });

    const inquiry = await Inquiry.create({
      studentId: String(studentId).trim(),
      tripId: tripId || null,
      message,
      status: "open",
      response: "",
    });

    res.status(201).json({ message: "Inquiry created", inquiry });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);
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

    const inquiry = await Inquiry.findById(id);
    if (!inquiry) return res.status(404).json({ message: "Inquiry not found" });

    inquiry.response = response || "";
    inquiry.status = status;
    inquiry.respondedBy = "admin_demo";
    inquiry.respondedAt = new Date();

    await inquiry.save();
    res.json({ message: "Inquiry updated", inquiry });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { createInquiry, getInquiry, respondInquiry };

