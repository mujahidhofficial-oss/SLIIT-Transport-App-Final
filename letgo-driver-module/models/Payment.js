const mongoose = require("mongoose");
// models/Payment.js - Payment schema for ride transactions. Linked to Booking, used for both card and cash payments.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: false },

    // Keep these for linking payment <-> users/trips later.
    customerId: { type: String, required: true },
    driverId: { type: String, required: false },
    /** On-demand ride id — links payment to trip earning (dedupe). */
    rideRequestId: { type: String, required: false, default: "", trim: true },

    tripDescription: { type: String, default: "" },
    tipDescription: { type: String, default: "" },
    basicClassification: { type: String, default: "" },
    subcategory: { type: String, default: "" },
    amount: { type: Number, required: true },
    adminFee: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    referenceCode: { type: String, default: "", index: true },

    paymentMethod: { type: String, enum: ["card", "cash"], required: true },
    method: { type: String, enum: ["card", "cash"], default: undefined },

    status: {
      type: String,
      enum: ["pending", "pending_verification", "completed", "refunded", "failed"],
      default: "pending",
    },

    stripePaymentIntentId: { type: String, default: "" },
    cashProofUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);

