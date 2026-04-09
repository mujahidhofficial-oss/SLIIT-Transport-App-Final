const express = require("express");
const router = express.Router();

const { createInquiry, getInquiry, respondInquiry } = require("../controllers/inquiryController");

router.post("/create", createInquiry);
router.get("/:id", getInquiry);
router.put("/:id/respond", respondInquiry);

module.exports = router;

