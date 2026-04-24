const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Driver = require("../models/Driver");
const { signToken } = require("../config/auth");
const {
  runLicenseOcr,
  licenseMatchesOcr,
  guessScannedLicenseFromOcr,
  normalizeLicense,
} = require("../utils/licenseOcr");
const { issuePendingLicense, takePending } = require("../utils/pendingLicenseVerify");
const {
  createDriver,
  findDriverByEmail,
  findDriverById,
  updateDriverById,
  updateDriverLicenseDocument,
} = require("../utils/authMemoryStore");
const { emailMatchExpr } = require("../utils/emailLookup");

const isDbConnected = () => mongoose.connection?.readyState === 1;

const sanitizeDriver = (driver) => ({
  id: String(driver._id),
  email: driver.email,
  role: "driver",
  profile: {
    fullName: driver.fullName,
    phone: driver.phone,
    licenseNumber: driver.licenseNumber,
    licenseCategory: driver.licenseCategory || "",
    licenseExpiry: driver.licenseExpiry || "",
    licenseDocumentUrl: driver.licenseDocumentUrl || "",
    vehicleNumber: driver.vehicleNumber,
    vehicleType: driver.vehicleType || "",
    currentVehicle: driver.currentVehicle || "",
    showLocation: !!driver.showLocation,
    availability: typeof driver.availability === "boolean" ? driver.availability : true,
    bankAccountName: driver.bankAccountName || "",
    bankName: driver.bankName || "",
    bankAccountNumber: driver.bankAccountNumber || "",
    bankBranch: driver.bankBranch || "",
  },
});

const LICENSE_MISMATCH_MSG =
  "License number in the uploaded photo does not match the entered license number.";
const OCR_UNREADABLE_MSG =
  "Could not read text from the license photo. Try a clearer, well-lit image with the license number visible.";

function isLicenseOcrSkipped() {
  const v = String(process.env.SKIP_LICENSE_OCR ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const registerDriver = async (req, res) => {
  let filePath = req.file?.path;
  const verifyTokenRaw = String(req.body?.verifyToken ?? "").trim();

  const deletePath = (p) => {
    if (p && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (_) {
        /* ignore */
      }
    }
  };

  const cleanupMulterOnly = () => deletePath(req.file?.path);

  try {
    const {
      email,
      password,
      fullName,
      phone,
      licenseNumber,
      licenseCategory,
      licenseExpiry,
      vehicleNumber,
    } = req.body || {};

    if (!email || !password || !fullName || !phone || !licenseNumber || !vehicleNumber) {
      cleanupMulterOnly();
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!String(licenseCategory ?? "").trim() || !String(licenseExpiry ?? "").trim()) {
      cleanupMulterOnly();
      return res.status(400).json({ message: "License class and expiry are required" });
    }

    if (password.length < 6) {
      cleanupMulterOnly();
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = isDbConnected()
      ? await Driver.findOne(emailMatchExpr(normalizedEmail))
      : await findDriverByEmail(normalizedEmail);
    if (existing) {
      cleanupMulterOnly();
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    let usedVerifyToken = false;
    if (verifyTokenRaw) {
      const rec = takePending(verifyTokenRaw, normalizeLicense(licenseNumber));
      if (!rec?.absPath || !fs.existsSync(rec.absPath)) {
        cleanupMulterOnly();
        return res.status(400).json({
          message:
            "License check expired or the license number changed. Tap “Check license & number” again with the same photo and number.",
        });
      }
      if (req.file?.path && req.file.path !== rec.absPath) {
        cleanupMulterOnly();
      }
      filePath = rec.absPath;
      usedVerifyToken = true;
    } else if (!req.file) {
      return res.status(400).json({
        message:
          "Add a license photo, or run “Check license & number” first and complete registration within 15 minutes.",
      });
    }

    const skipOcr = isLicenseOcrSkipped() || usedVerifyToken;
    if (skipOcr && !usedVerifyToken) {
      console.warn(
        "[drivers/register] SKIP_LICENSE_OCR is enabled — license image is stored but not verified. Do not use in production unless you accept the risk."
      );
    }
    if (!skipOcr) {
      let ocrText = "";
      try {
        ocrText = await runLicenseOcr(filePath);
      } catch {
        deletePath(filePath);
        return res.status(500).json({
          message: "License verification failed. Try a clearer photo or try again in a moment.",
        });
      }

      if (!String(ocrText).trim()) {
        deletePath(filePath);
        return res.status(400).json({ message: OCR_UNREADABLE_MSG });
      }

      if (!licenseMatchesOcr(ocrText, licenseNumber)) {
        deletePath(filePath);
        return res.status(400).json({
          message: LICENSE_MISMATCH_MSG,
          scannedLicenseNumber: guessScannedLicenseFromOcr(ocrText),
        });
      }
    }

    const relativeUrl = `/uploads/${path.basename(filePath)}`;

    const passwordHash = await bcrypt.hash(password, 10);

    const driver = isDbConnected()
      ? await Driver.create({
          email: normalizedEmail,
          passwordHash,
          fullName: String(fullName).trim(),
          phone: String(phone).trim(),
          licenseNumber: String(licenseNumber).trim(),
          licenseCategory: String(licenseCategory ?? "").trim(),
          licenseExpiry: String(licenseExpiry ?? "").trim(),
          licenseDocumentUrl: relativeUrl,
          vehicleNumber: String(vehicleNumber).trim(),
          vehicleType: "",
          currentVehicle: String(vehicleNumber).trim(),
          showLocation: false,
          availability: true,
        })
      : await createDriver({
          email: normalizedEmail,
          password,
          fullName,
          phone,
          licenseNumber,
          licenseCategory,
          licenseExpiry,
          vehicleNumber,
          licenseDocumentUrl: relativeUrl,
        });

    const token = signToken({ sub: driver._id, role: "driver" });
    const user = sanitizeDriver(driver);

    const ocrDevSkipped = isLicenseOcrSkipped() && !usedVerifyToken;
    const regMessage = usedVerifyToken
      ? isDbConnected()
        ? "Driver account created — license already checked; no second OCR wait."
        : "Driver account created (memory) — license already checked."
      : skipOcr
        ? isDbConnected()
          ? "Driver account created — OCR skipped on server (fast dev mode)."
          : "Driver account created (memory) — OCR skipped on server (fast dev mode)."
        : isDbConnected()
          ? "Driver account created successfully — license verified."
          : "Driver account created successfully (memory) — license verified.";

    return res.status(201).json({
      message: regMessage,
      token,
      user,
      verifiedLicenseNumber: usedVerifyToken || !isLicenseOcrSkipped(),
      licenseOcrSkipped: ocrDevSkipped,
      driver: {
        id: String(driver._id),
        email: driver.email,
        fullName: driver.fullName,
        phone: driver.phone,
        licenseNumber: driver.licenseNumber,
        licenseCategory: driver.licenseCategory || "",
        licenseExpiry: driver.licenseExpiry || "",
        licenseDocumentUrl: driver.licenseDocumentUrl || "",
        vehicleNumber: driver.vehicleNumber,
      },
    });
  } catch (error) {
    deletePath(filePath);
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
};

/** Quick check: OCR + compare license number; on success keeps file and returns verifyToken for fast /register. */
const verifyDriverLicense = async (req, res) => {
  const filePath = req.file?.path;

  const deletePathLocal = (p) => {
    if (p && fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (_) {
        /* ignore */
      }
    }
  };

  try {
    const licenseNumber = String(req.body?.licenseNumber ?? "").trim();
    if (!req.file) {
      return res.status(400).json({ message: "License photo is required (JPG or PNG)." });
    }
    if (!licenseNumber) {
      deletePathLocal(filePath);
      return res.status(400).json({ message: "Enter your license number first." });
    }

    if (isLicenseOcrSkipped()) {
      deletePathLocal(filePath);
      return res.json({
        verified: true,
        licenseOcrSkipped: true,
        typedNormalized: normalizeLicense(licenseNumber),
        message: "Server has OCR disabled — photo vs number was not compared. You can register immediately.",
      });
    }

    let ocrText = "";
    try {
      ocrText = await runLicenseOcr(filePath);
    } catch {
      deletePathLocal(filePath);
      return res.status(500).json({
        message: "Could not read the license photo. Try again with better lighting or a steadier shot.",
      });
    }

    if (!String(ocrText).trim()) {
      deletePathLocal(filePath);
      return res.status(400).json({ message: OCR_UNREADABLE_MSG });
    }

    if (!licenseMatchesOcr(ocrText, licenseNumber)) {
      deletePathLocal(filePath);
      return res.status(400).json({
        message: LICENSE_MISMATCH_MSG,
        scannedLicenseNumber: guessScannedLicenseFromOcr(ocrText),
        typedNormalized: normalizeLicense(licenseNumber),
      });
    }

    const verifyToken = issuePendingLicense(filePath, normalizeLicense(licenseNumber));
    return res.json({
      verified: true,
      verifyToken,
      typedNormalized: normalizeLicense(licenseNumber),
      scannedHint: guessScannedLicenseFromOcr(ocrText),
      message:
        "License number matches the photo. Complete registration within 15 minutes — you do not need to upload the photo again.",
    });
  } catch (e) {
    deletePathLocal(filePath);
    return res.status(500).json({ message: e.message });
  }
};

const loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const driver = isDbConnected()
      ? await Driver.findOne(emailMatchExpr(normalizedEmail))
      : await findDriverByEmail(normalizedEmail);

    if (!driver) {
      return res.status(401).json({
        message:
          "No driver account for this email. Register on the Driver tab or sign in as a passenger if you used Sign up.",
        code: "UNKNOWN_EMAIL",
      });
    }

    const ok = await bcrypt.compare(password, driver.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = signToken({ sub: driver._id, role: "driver" });
    const user = sanitizeDriver(driver);

    return res.json({
      message: "Driver login successful",
      token,
      user,
      driver: {
        id: String(driver._id),
        email: driver.email,
        fullName: driver.fullName,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const getDriverMe = async (req, res) => {
  try {
    if (req.user?.role !== "driver") {
      return res.status(403).json({ message: "Driver access only" });
    }
    const driverId = req.user?.sub;
    if (!driverId) return res.status(401).json({ message: "Invalid token payload" });

    const driver = isDbConnected()
      ? await Driver.findById(driverId)
      : findDriverById(driverId);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    return res.json({ driver: sanitizeDriver(driver) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateDriverMe = async (req, res) => {
  try {
    if (req.user?.role !== "driver") {
      return res.status(403).json({ message: "Driver access only" });
    }
    const driverId = req.user?.sub;
    if (!driverId) return res.status(401).json({ message: "Invalid token payload" });

    const patch = {
      fullName: String(req.body?.driverName ?? "").trim(),
      vehicleNumber: String(req.body?.vehicleNumber ?? "").trim(),
      vehicleType: String(req.body?.vehicleType ?? "").trim(),
      currentVehicle: String(req.body?.currentVehicle ?? "").trim(),
      showLocation: !!req.body?.showLocation,
      availability: typeof req.body?.availability === "boolean" ? req.body.availability : true,
    };

    const licenseFromBody = String(req.body?.licenseNumber ?? req.body?.nationalId ?? "").trim();
    if (!patch.fullName || !patch.vehicleNumber || !patch.vehicleType || !licenseFromBody || !patch.currentVehicle) {
      return res.status(400).json({
        message: "driverName, vehicleNumber, vehicleType, driving licence number and currentVehicle are required",
      });
    }

    let updated;
    if (isDbConnected()) {
      updated = await Driver.findByIdAndUpdate(
        driverId,
        {
          fullName: patch.fullName,
          vehicleNumber: patch.vehicleNumber,
          vehicleType: patch.vehicleType,
          currentVehicle: patch.currentVehicle,
          showLocation: patch.showLocation,
          availability: patch.availability,
          licenseNumber: licenseFromBody,
        },
        { new: true }
      );
    } else {
      updated = updateDriverById(driverId, {
        fullName: patch.fullName,
        vehicleNumber: patch.vehicleNumber,
        vehicleType: patch.vehicleType,
        currentVehicle: patch.currentVehicle,
        showLocation: patch.showLocation,
        availability: patch.availability,
        licenseNumber: licenseFromBody,
      });
    }

    if (!updated) return res.status(404).json({ message: "Driver not found" });
    return res.json({ message: "Driver details updated", driver: sanitizeDriver(updated) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateDriverBankDetails = async (req, res) => {
  try {
    if (req.user?.role !== "driver") {
      return res.status(403).json({ message: "Driver access only" });
    }
    const driverId = req.user?.sub;
    if (!driverId) return res.status(401).json({ message: "Invalid token payload" });

    const bankAccountName = String(req.body?.bankAccountName ?? "").trim();
    const bankName = String(req.body?.bankName ?? "").trim();
    const bankAccountNumber = String(req.body?.bankAccountNumber ?? "").trim();
    const bankBranch = String(req.body?.bankBranch ?? "").trim();

    let updated;
    if (isDbConnected()) {
      updated = await Driver.findByIdAndUpdate(
        driverId,
        { bankAccountName, bankName, bankAccountNumber, bankBranch },
        { new: true }
      );
    } else {
      updated = updateDriverById(driverId, {
        bankAccountName,
        bankName,
        bankAccountNumber,
        bankBranch,
      });
    }

    if (!updated) return res.status(404).json({ message: "Driver not found" });
    return res.json({ message: "Bank details saved", driver: sanitizeDriver(updated) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const emptyBankPayload = () => ({
  bankAccountName: "",
  bankName: "",
  bankAccountNumber: "",
  bankBranch: "",
  driverFullName: "",
  hasBankDetails: false,
});

const getPublicDriverBankDetails = async (req, res) => {
  try {
    const driverId = String(req.params?.driverId ?? "").trim();
    if (!driverId) return res.status(400).json({ message: "driverId required" });

    let driver = null;
    if (isDbConnected()) {
      try {
        if (mongoose.Types.ObjectId.isValid(driverId)) {
          driver = await Driver.findById(driverId);
        }
      } catch {
        driver = null;
      }
    } else {
      driver = findDriverById(driverId);
    }

    if (!driver) {
      return res.json(emptyBankPayload());
    }

    const bankAccountName = String(driver.bankAccountName ?? "").trim();
    const bankName = String(driver.bankName ?? "").trim();
    const bankAccountNumber = String(driver.bankAccountNumber ?? "").trim();
    const bankBranch = String(driver.bankBranch ?? "").trim();
    const hasBankDetails = Boolean(bankName && bankAccountNumber);

    return res.json({
      bankAccountName,
      bankName,
      bankAccountNumber,
      bankBranch,
      driverFullName: String(driver.fullName ?? "").trim(),
      hasBankDetails,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const uploadDriverLicense = async (req, res) => {
  try {
    const { driverId } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "License image or PDF is required" });
    }

    const relativeUrl = `/uploads/${req.file.filename}`;

    if (isDbConnected()) {
      const updated = await Driver.findByIdAndUpdate(driverId, { licenseDocumentUrl: relativeUrl }, { new: true });
      if (!updated) return res.status(404).json({ message: "Driver not found" });
      return res.json({ message: "License document saved", licenseDocumentUrl: relativeUrl });
    }

    const mem = updateDriverLicenseDocument(driverId, relativeUrl);
    if (!mem) return res.status(404).json({ message: "Driver not found" });
    return res.json({ message: "License document saved (memory)", licenseDocumentUrl: relativeUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerDriver,
  verifyDriverLicense,
  loginDriver,
  getDriverMe,
  updateDriverMe,
  updateDriverBankDetails,
  getPublicDriverBankDetails,
  uploadDriverLicense,
};
