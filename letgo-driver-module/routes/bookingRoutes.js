const express = require("express");
const router = express.Router();
const {
  createBookingRequest,
  getBookingsForTrip,
  respondToBooking,
  cancelBooking,
  getBookingHistory,
  getDriverAnalytics
} = require("../controllers/bookingController");

router.post("/", createBookingRequest);
router.get("/trip/:tripId", getBookingsForTrip);
router.get("/history", getBookingHistory);
router.get("/driver/:driverId/analytics", getDriverAnalytics);
router.put("/:bookingId/respond", respondToBooking);
router.put("/:bookingId/cancel", cancelBooking);

module.exports = router;
