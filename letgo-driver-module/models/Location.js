const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true },
    driverId: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Location", locationSchema);

