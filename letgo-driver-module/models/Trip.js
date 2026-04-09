const mongoose = require("mongoose");

const tripSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      required: true
    },
    pickupLocation: {
      type: String,
      required: true
    },
    destination: {
      type: String,
      required: true
    },
    departureTime: {
      type: Date,
      required: true
    },
    seatLimit: {
      type: Number,
      required: true
    },
    availableSeats: {
      type: Number,
      required: true
    },
    pricePerSeat: {
      type: Number,
      required: true
    },
    // Optional for MVP dynamic pricing by distance.
    // You can extend the driver create-trip UI to send this later.
    distanceKm: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["scheduled", "started", "ended"],
      default: "scheduled"
    },
    trackingEnabled: {
      type: Boolean,
      default: false
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trip", tripSchema);
