const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    customerId: { type: String, required: true },
    reason: { type: String, default: "" },
    amount: { type: Number, required: true },
    refundType: { type: String, enum: ["full", "partial"], default: "full" },
    status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
    stripeRefundId: { type: String, default: "" },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Refund", refundSchema);

