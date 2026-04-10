const express = require("express");
// Routes for handling booking-related operations such as creating booking requests, responding to bookings, and fetching booking history. These routes interact with the bookingController to perform the necessary business logic and database operations.
const router = express.Router();
const {
  createBookingRequest,
  getBookingsForTrip,
  respondToBooking,
  cancelBooking,
  getBookingHistory,
  getDriverAnalytics
} = require("../controllers/bookingController");
// Route to create a new booking request
router.post("/", createBookingRequest);
router.get("/trip/:tripId", getBookingsForTrip);
router.get("/history", getBookingHistory);
router.get("/driver/:driverId/analytics", getDriverAnalytics);
router.put("/:bookingId/respond", respondToBooking);
router.put("/:bookingId/cancel", cancelBooking);

module.exports = router;
