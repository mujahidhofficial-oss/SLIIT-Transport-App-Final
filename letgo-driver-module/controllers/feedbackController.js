const DriverFeedback = require("../models/DriverFeedback");

function normalizeText(v) {
  return String(v ?? "").trim();
}

const createFeedback = async (req, res) => {
  try {
    const rideRequestId = normalizeText(req.body?.rideRequestId);
    const driverId = normalizeText(req.body?.driverId);
    const passengerId = normalizeText(req.body?.passengerId);
    const comment = normalizeText(req.body?.comment);
    const ratingRaw = Number(req.body?.rating);
    const rating = Number.isFinite(ratingRaw) ? Math.round(ratingRaw) : NaN;

    if (!rideRequestId || !driverId || !passengerId || !Number.isFinite(rating)) {
      return res.status(400).json({
        message: "rideRequestId, driverId, passengerId and rating are required",
      });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be between 1 and 5" });
    }

    const feedback = await DriverFeedback.findOneAndUpdate(
      { rideRequestId, passengerId },
      { $set: { driverId, rating, comment } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ message: "Feedback saved", feedback });
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Feedback already exists for this ride" });
    }
    return res.status(500).json({ message: e.message || "Failed to save feedback" });
  }
};

const getDriverFeedback = async (req, res) => {
  try {
    const driverId = normalizeText(req.params?.driverId);
    if (!driverId) return res.status(400).json({ message: "driverId is required" });

    const feedback = await DriverFeedback.find({ driverId }).sort({ createdAt: -1 }).lean();
    const summary = await DriverFeedback.aggregate([
      { $match: { driverId } },
      {
        $group: {
          _id: "$driverId",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const top = summary[0] || { averageRating: 0, totalReviews: 0 };
    return res.json({
      driverId,
      averageRating: Number(top.averageRating || 0),
      totalReviews: Number(top.totalReviews || 0),
      feedback,
    });
  } catch (e) {
    return res.status(500).json({ message: e.message || "Failed to load feedback" });
  }
};

module.exports = { createFeedback, getDriverFeedback };
