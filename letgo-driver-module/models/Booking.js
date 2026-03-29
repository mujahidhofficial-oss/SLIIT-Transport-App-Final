const mongoose = require("mongoose");
// Booking schema to represent a booking made by a customer for a trip. It includes references to the trip, customer, seat numbers, total amount, and status of the booking.
const bookingSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true
    },
    customerId: {
      type: String,
      required: true
    },
    seatNumbers: {
      type: [Number],
      default: []
    },
    seatsRequested: {
      type: Number,
      required: true
    },
    totalAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "paid", "cancelled"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
