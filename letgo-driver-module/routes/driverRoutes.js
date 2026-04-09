const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const uploadLicenseImage = require("../middleware/uploadLicenseImage");
const { requireAuth } = require("../middleware/auth");
const {
  registerDriver,
  verifyDriverLicense,
  loginDriver,
  getDriverMe,
  updateDriverMe,
  updateDriverBankDetails,
  getPublicDriverBankDetails,
  uploadDriverLicense,
} = require("../controllers/driverController");
const { getDriverPaymentEarnings } = require("../controllers/driverEarningsController");

function withLicenseUpload(req, res, next) {
  uploadLicenseImage.single("licenseImage")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Invalid license photo upload" });
    }
    next();
  });
}

/** register may omit licenseImage if a valid verifyToken is sent (OCR already done). */
function withOptionalLicenseImage(req, res, next) {
  uploadLicenseImage.single("licenseImage")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Invalid license photo upload" });
    }
    next();
  });
}

router.post("/verify-license", withLicenseUpload, verifyDriverLicense);
router.post("/register", withOptionalLicenseImage, registerDriver);
router.post("/login", loginDriver);
router.get("/me", requireAuth, getDriverMe);
router.put("/me", requireAuth, updateDriverMe);
router.put("/me/bank", requireAuth, updateDriverBankDetails);
router.get("/:driverId/bank-details", getPublicDriverBankDetails);
router.get("/:driverId/earnings", getDriverPaymentEarnings);
router.post("/:driverId/upload-license", upload.single("license"), uploadDriverLicense);

module.exports = router;
