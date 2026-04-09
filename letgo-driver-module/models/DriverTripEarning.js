const mongoose = require("mongoose");

/** One row when driver taps “Finish trip” on an on-demand ride (before/without passenger payment). */
const driverTripEarningSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, trim: true },
    rideRequestId: { type: String, required: true, trim: true },
    fareLkr: { type: Number, required: true },
    routeLabel: { type: String, default: "" },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

driverTripEarningSchema.index({ driverId: 1, rideRequestId: 1 }, { unique: true });

module.exports = mongoose.model("DriverTripEarning", driverTripEarningSchema);
