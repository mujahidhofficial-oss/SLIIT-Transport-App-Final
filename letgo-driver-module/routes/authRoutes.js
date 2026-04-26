const express = require("express");
const router = express.Router();

const { register, login, sendSignupOtp, verifySignupOtp } = require("../controllers/authController");

router.post("/signup/send-otp", sendSignupOtp);
router.post("/signup/verify-otp", verifySignupOtp);
router.post("/register", register);
router.post("/login", login);

module.exports = router;

