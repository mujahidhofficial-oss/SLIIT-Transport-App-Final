const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Refund = require("../models/Refund");

function generateReferenceCode() {
  return `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function parseMoney(value) {
  const num = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(num) ? num : 0;
}

// Fallback store when MongoDB is disconnected.
// This lets you test the UI flow even if Atlas DNS/network is unavailable.
const demoPaymentsMemory = new Map();
function isDbConnected() {
  return mongoose.connection.readyState === 1; // connected
}
function createMemoryId() {
  return `mem_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function createDemoPayment(req, res) {
  try {
    const {
      referenceCode,
      tripDescription,
      tipDescription,
      basicClassification,
      subcategory,
      amount,
      adminFee,
      total,
      paymentMethod,
      customerId,
      driverId,
      rideRequestId,
      notes,
    } = req.body;

    const safePaymentMethod = paymentMethod === "cash" ? "cash" : "card";
    const finalRef = referenceCode || generateReferenceCode();

    const a = parseMoney(amount);
    const f = parseMoney(adminFee);
    const t = total !== undefined && total !== null ? parseMoney(total) : a + f;

    if (!tripDescription || !basicClassification || !subcategory) {
      return res.status(400).json({ message: "Missing bill details" });
    }
    if (!safePaymentMethod) {
      return res.status(400).json({ message: "paymentMethod is required" });
    }
    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }
    if (a <= 0 || f < 0 || t <= 0) {
      return res.status(400).json({ message: "Invalid amounts" });
    }

    const status = safePaymentMethod === "cash" ? "pending_verification" : "pending";

    if (!isDbConnected()) {
      const payment = {
        _id: createMemoryId(),
        bookingId: null,
        customerId: String(customerId),
        driverId: driverId ? String(driverId).trim() : "demo-driver",
        tripDescription: String(tripDescription),
        tipDescription: String(tipDescription ?? ""),
        basicClassification: String(basicClassification),
        subcategory: String(subcategory),
        amount: a,
        adminFee: f,
        total: t,
        referenceCode: String(finalRef),
        paymentMethod: safePaymentMethod,
        status,
        stripePaymentIntentId: "",
        cashProofUrl: "",
        rideRequestId: rideRequestId ? String(rideRequestId).trim() : "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      demoPaymentsMemory.set(payment._id, payment);
      res.status(201).json({ message: "Payment created (memory)", payment });
      return;
    }

    const payment = await Payment.create({
      bookingId: null,
      customerId: String(customerId),
      driverId: driverId ? String(driverId).trim() : "demo-driver",
      tripDescription: String(tripDescription),
      tipDescription: String(tipDescription ?? ""),
      basicClassification: String(basicClassification),
      subcategory: String(subcategory),
      amount: a,
      adminFee: f,
      total: t,
      referenceCode: String(finalRef),
      paymentMethod: safePaymentMethod,
      status,
      cashProofUrl: "",
      rideRequestId: rideRequestId ? String(rideRequestId).trim() : "",
    });

    res.status(201).json({ message: "Payment created", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

async function getDemoPaymentById(req, res) {
  try {
    const { paymentId } = req.params;

    const fromMemory = demoPaymentsMemory.get(paymentId);
    if (fromMemory) return res.json(fromMemory);

    if (!isDbConnected()) return res.status(404).json({ message: "Payment not found" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    return res.json(payment);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

async function uploadDemoCashSlip(req, res) {
  try {
    const { paymentId } = req.params;
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const memoryPayment = demoPaymentsMemory.get(paymentId);
    if (memoryPayment) {
      if (memoryPayment.paymentMethod !== "cash") {
        return res.status(400).json({ message: "This payment is not cash" });
      }
      memoryPayment.cashProofUrl = `/uploads/${req.file.filename}`;
      memoryPayment.status = "pending_verification";
      memoryPayment.updatedAt = new Date();
      demoPaymentsMemory.set(paymentId, memoryPayment);
      return res.json({ message: "Slip uploaded (memory)", payment: memoryPayment });
    }

    if (!isDbConnected()) return res.status(404).json({ message: "Payment not found" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.paymentMethod !== "cash") {
      return res.status(400).json({ message: "This payment is not cash" });
    }

    payment.cashProofUrl = `/uploads/${req.file.filename}`;
    payment.status = "pending_verification";
    await payment.save();

    res.json({ message: "Slip uploaded", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

async function confirmDemoCardPayment(req, res) {
  try {
    const { paymentId } = req.params;
    const memoryPayment = demoPaymentsMemory.get(paymentId);
    if (memoryPayment) {
      if (memoryPayment.paymentMethod !== "card") return res.status(400).json({ message: "This payment is not card" });
      memoryPayment.status = "completed";
      memoryPayment.updatedAt = new Date();
      demoPaymentsMemory.set(paymentId, memoryPayment);
      return res.json({ message: "Card payment confirmed (demo-memory)", payment: memoryPayment });
    }

    if (!isDbConnected()) return res.status(404).json({ message: "Payment not found" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.paymentMethod !== "card") {
      return res.status(400).json({ message: "This payment is not card" });
    }

    // Demo: confirm immediately (Stripe later with webhook)
    payment.status = "completed";
    await payment.save();

    return res.json({ message: "Card payment confirmed (demo)", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

async function verifyDemoCashPayment(req, res) {
  try {
    const { paymentId } = req.params;
    const memoryPayment = demoPaymentsMemory.get(paymentId);
    if (memoryPayment) {
      if (memoryPayment.paymentMethod !== "cash") return res.status(400).json({ message: "This payment is not cash" });
      memoryPayment.status = "completed";
      memoryPayment.updatedAt = new Date();
      demoPaymentsMemory.set(paymentId, memoryPayment);
      return res.json({ message: "Cash payment verified (demo-memory)", payment: memoryPayment });
    }

    if (!isDbConnected()) return res.status(404).json({ message: "Payment not found" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    if (payment.paymentMethod !== "cash") {
      return res.status(400).json({ message: "This payment is not cash" });
    }

    // Demo: mark completed
    payment.status = "completed";
    await payment.save();

    return res.json({ message: "Cash payment verified (demo)", payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

async function refundDemoPayment(req, res) {
  try {
    const { paymentId } = req.params;
    const { reason, refundType = "full", amount } = req.body;

    const memoryPayment = demoPaymentsMemory.get(paymentId);
    if (memoryPayment) {
      memoryPayment.status = "refunded";
      memoryPayment.updatedAt = new Date();
      demoPaymentsMemory.set(paymentId, memoryPayment);
      return res.json({ message: "Refund processed (demo-memory)", payment: memoryPayment });
    }

    if (!isDbConnected()) return res.status(404).json({ message: "Payment not found" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ message: "Payment not found" });

    const refund = await Refund.create({
      paymentId: payment._id,
      bookingId: payment.bookingId || null,
      customerId: payment.customerId,
      reason: reason || "",
      amount: amount || payment.total,
      refundType,
      status: "processing",
      stripeRefundId: "",
    });

    payment.status = "refunded";
    await payment.save();

    refund.status = "completed";
    refund.processedAt = new Date();
    await refund.save();

    res.json({ message: "Refund processed (demo)", refund, payment });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

function getAllMemoryPayments() {
  return Array.from(demoPaymentsMemory.values());
}

module.exports = {
  createDemoPayment,
  getDemoPaymentById,
  uploadDemoCashSlip,
  confirmDemoCardPayment,
  verifyDemoCashPayment,
  refundDemoPayment,
  getAllMemoryPayments,
};

