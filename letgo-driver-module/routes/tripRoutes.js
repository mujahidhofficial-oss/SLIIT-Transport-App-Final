const express = require("express");
const router = express.Router();
const {
  createTrip,
  getAllVisibleTrips,
  startTrip,
  updateTripLocation,
  endTrip
} = require("../controllers/tripController");

router.post("/", createTrip);
router.get("/", getAllVisibleTrips);
router.put("/:tripId/start", startTrip);
router.put("/:tripId/location", updateTripLocation);
router.put("/:tripId/end", endTrip);

module.exports = router;
