const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true, trim: true },
    pickup: {
      address: { type: String, default: "", trim: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    dropoff: {
      address: { type: String, default: "", trim: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    distanceKm: { type: Number, default: 0 },
    estimatedFareLkr: { type: Number, default: 0 },
    vehicleType: { type: String, default: "car", trim: true },
    seatCount: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "cancelled", "completed"],
      default: "pending",
    },
    driverId: { type: String, default: "", trim: true },
    driverName: { type: String, default: "", trim: true },
    driverPhone: { type: String, default: "", trim: true },
    vehicleNumber: { type: String, default: "", trim: true },
    vehicleType: { type: String, default: "", trim: true },
    driverShowLocation: { type: Boolean, default: false },
    /** Latest driver price offer while status is pending (shown to passenger). */
    driverBidLkr: { type: Number, default: 0 },
    driverBidDriverId: { type: String, default: "", trim: true },
    driverBidDriverName: { type: String, default: "", trim: true },
    /** Passenger reaction to the latest driver fare offer while pending. */
    passengerBidResponse: {
      type: String,
      enum: ["none", "accepted", "declined"],
      default: "none",
    },
    /** After accept: driver taps “arrived at pickup” — shown to passenger + driver. */
    driverAtPickup: { type: Boolean, default: false },
    driverAtPickupAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RideRequest", rideRequestSchema);

