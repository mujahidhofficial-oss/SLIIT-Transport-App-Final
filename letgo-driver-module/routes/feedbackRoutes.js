const express = require("express");
const router = express.Router();

const { createFeedback, getDriverFeedback } = require("../controllers/feedbackController");

router.post("/", createFeedback);
router.get("/driver/:driverId", getDriverFeedback);

module.exports = router;
