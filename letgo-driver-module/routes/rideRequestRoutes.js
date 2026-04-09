const express = require("express");
const router = express.Router();

const {
  createRideRequest,
  getRideRequestById,
  listMyRideRequests,
  listDriverRideRequests,
  listPendingRideRequests,
  submitDriverBid,
  setPassengerBidResponse,
  markDriverArrivedAtPickup,
  respondRideRequest,
  completeRideRequest,
} = require("../controllers/rideRequestController");

router.post("/", createRideRequest);
router.get("/pending", listPendingRideRequests);
router.get("/my", listMyRideRequests);
router.get("/driver/my", listDriverRideRequests);
router.put("/:requestId/bid", submitDriverBid);
router.put("/:requestId/bid-response", setPassengerBidResponse);
router.put("/:requestId/arrived-at-pickup", markDriverArrivedAtPickup);
router.get("/:requestId", getRideRequestById);
router.put("/:requestId/respond", respondRideRequest);
router.put("/:requestId/complete", completeRideRequest);

module.exports = router;

