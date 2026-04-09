const mongoose = require("mongoose");

const inquirySchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, trim: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
    response: { type: String, default: "" },
    respondedBy: { type: String, default: "" },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inquiry", inquirySchema);

