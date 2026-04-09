const path = require("path");
const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const Refund = require("../models/Refund");

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

const createCardPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) return res.status(400).json({ message: "bookingId is required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const payment = await createPaymentBase({
      bookingId: booking._id,
      customerId: booking.customerId,
      driverId: "driver_unknown",
      amount: booking.totalAmount,
      paymentMethod: "card",
      status: "pending",
    });

    // Demo: immediately complete (Stripe webhook later)
    payment.status = "completed";
    await payment.save();

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

