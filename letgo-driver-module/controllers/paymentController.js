const path = require("path");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const Trip = require("../models/Trip");
const Refund = require("../models/Refund");
const { createAndEmitNotification } = require("../utils/notify");

// Demo payment processing for MVP scaffold (Stripe later)
function simulateCardIntent() {
  return `pi_demo_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

async function createPaymentBase({ bookingId, customerId, driverId, amount, paymentMethod, status }) {
  const payment = await Payment.create({
    bookingId,
    customerId,
    driverId,
    amount,
    adminFee: 0,
    total: amount,
    paymentMethod,
    status,
    stripePaymentIntentId: paymentMethod === "card" ? simulateCardIntent() : "",
  });
  return payment;
}

async function resolveDriverIdFromBooking(booking) {
  if (!booking?.tripId) return "";
  const trip = await Trip.findById(booking.tripId).select("driverId");
  return String(trip?.driverId ?? "").trim();
}

const createCardPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const driverId = await resolveDriverIdFromBooking(booking);

    const payment = await createPaymentBase({
      bookingId: booking._id,
      customerId: booking.customerId,
      driverId,
      amount: booking.totalAmount,
      paymentMethod: "card",
      status: "pending",
    });

    // Demo: immediately complete (Stripe webhook later)
    payment.status = "completed";
    await payment.save();
    await createAndEmitNotification(req, {
      userId: String(payment.customerId),
      type: "payment",
      title: "Payment successful",
      message: "Your card payment was completed successfully.",
      meta: { paymentId: String(payment._id), bookingId: String(payment.bookingId), status: payment.status },
    });
    if (String(payment.driverId ?? "").trim()) {
      await createAndEmitNotification(req, {
        userId: String(payment.driverId),
        type: "payment",
        title: "Payment received",
        message: "A customer payment was completed for your booking.",
        meta: { paymentId: String(payment._id), bookingId: String(payment.bookingId), status: payment.status },
      });
    }

    res.status(201).json({ message: "Card payment processed (demo)", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const uploadCashSlip = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    payment.cashProofUrl = `/uploads/${req.file.filename}`;
    payment.status = "pending_verification";
    await payment.save();
    await createAndEmitNotification(req, {
      userId: String(payment.customerId),
      type: "payment",
      title: "Cash proof uploaded",
      message: "Your cash payment proof was uploaded and is pending verification.",
      meta: { paymentId: String(payment._id), status: payment.status },
    });
    if (String(payment.driverId ?? "").trim()) {
      await createAndEmitNotification(req, {
        userId: String(payment.driverId),
        type: "payment",
        title: "Cash proof submitted",
        message: "Customer has uploaded cash payment proof for verification.",
        meta: { paymentId: String(payment._id), status: payment.status },
      });
    }

    res.json({ message: "Cash slip uploaded", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const confirmCashPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    payment.status = "completed";
    await payment.save();
    await createAndEmitNotification(req, {
      userId: String(payment.customerId),
      type: "payment",
      title: "Cash payment verified",
      message: "Your cash payment was verified successfully.",
      meta: { paymentId: String(payment._id), status: payment.status },
    });
    if (String(payment.driverId ?? "").trim()) {
      await createAndEmitNotification(req, {
        userId: String(payment.driverId),
        type: "payment",
        title: "Cash payment verified",
        message: "Cash payment for your booking has been verified.",
        meta: { paymentId: String(payment._id), status: payment.status },
      });
    }

    res.json({ message: "Cash payment verified (demo)", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const refundPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason, refundType = "full", amount } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const booking = await Booking.findById(payment.bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const refund = await Refund.create({
      paymentId: payment._id,
      bookingId: booking._id,
      customerId: payment.customerId,
      reason: reason || "",
      amount: amount || payment.amount,
      refundType,
      status: "processing",
    });

    // Demo complete refund
    payment.status = "refunded";
    await payment.save();

    refund.status = "completed";
    refund.processedAt = new Date();
    await refund.save();
    await createAndEmitNotification(req, {
      userId: String(payment.customerId),
      type: "payment",
      title: "Refund completed",
      message: "Your payment refund has been completed.",
      meta: { paymentId: String(payment._id), refundId: String(refund._id), status: payment.status },
    });

    res.json({ message: "Refund processed (demo)", refund, payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const { customerId } = req.query;
    const filter = customerId ? { customerId: String(customerId) } : {};
    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    res.json(payments);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = {
  createCardPayment,
  uploadCashSlip,
  confirmCashPayment,
  refundPayment,
  getPaymentHistory,
};

