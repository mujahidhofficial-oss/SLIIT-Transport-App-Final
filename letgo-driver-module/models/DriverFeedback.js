const mongoose = require("mongoose");

const driverFeedbackSchema = new mongoose.Schema(
  {
    rideRequestId: { type: String, required: true, trim: true },
    driverId: { type: String, required: true, trim: true, index: true },
    passengerId: { type: String, required: true, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

driverFeedbackSchema.index({ rideRequestId: 1, passengerId: 1 }, { unique: true });

module.exports = mongoose.model("DriverFeedback", driverFeedbackSchema);
