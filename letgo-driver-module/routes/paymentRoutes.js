// routes/paymentRoutes.js - Defines API endpoints for handling payments (card and cash) and payment history. Also includes demo routes for testing payment flows without actual processing.
const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  createCardPayment,
  confirmCashPayment,
  uploadCashSlip,
  refundPayment,
  getPaymentHistory,
} = require("../controllers/paymentController");
// Demo routes (no real payment processing, just simulating flows for UI testing)
router.post("/card", createCardPayment);
router.post("/cash/:paymentId/slip", upload.single("slip"), uploadCashSlip);
router.put("/cash/:paymentId/confirm", confirmCashPayment);

// Demo (matches UI flow: Process -> Payment method -> Upload slip -> Success)
router.post("/demo", require("../controllers/paymentDemoController").createDemoPayment);
router.get("/demo/:paymentId", require("../controllers/paymentDemoController").getDemoPaymentById);
router.post(
  "/demo/:paymentId/upload-slip",
  upload.single("slip"),
  require("../controllers/paymentDemoController").uploadDemoCashSlip
);
router.put("/demo/:paymentId/confirm-card", require("../controllers/paymentDemoController").confirmDemoCardPayment);
router.put("/demo/:paymentId/verify-cash", require("../controllers/paymentDemoController").verifyDemoCashPayment);
router.put("/demo/:paymentId/refund", require("../controllers/paymentDemoController").refundDemoPayment);
router.put("/refund/:paymentId", refundPayment);
router.get("/history", getPaymentHistory);

module.exports = router;
