const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Driver = require("../models/Driver");
const { signToken } = require("../config/auth");
const { createUser, findUserByEmail, findDriverByEmail } = require("../utils/authMemoryStore");
const { emailMatchExpr } = require("../utils/emailLookup");
const { createAndEmitNotification } = require("../utils/notify");
const { sendMail } = require("../utils/mailer");

const isDbConnected = () => mongoose.connection?.readyState === 1;
const signupOtpStore = new Map();
const verifiedSignupEmailStore = new Map();

function normalizeEmail(v) {
  return String(v ?? "").trim().toLowerCase();
}

function requireSignupOtp() {
  const raw = String(process.env.REQUIRE_SIGNUP_OTP ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function otpTtlMs() {
  const mins = Number(process.env.OTP_EXPIRES_MIN ?? 10);
  return (Number.isFinite(mins) && mins > 0 ? mins : 10) * 60 * 1000;
}

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function clearExpiredOtp() {
  const now = Date.now();
  for (const [email, rec] of signupOtpStore.entries()) {
    if (Number(rec.expiresAt) <= now) signupOtpStore.delete(email);
  }
  for (const [email, rec] of verifiedSignupEmailStore.entries()) {
    if (Number(rec.expiresAt) <= now) verifiedSignupEmailStore.delete(email);
  }
}

const sanitizeUser = (u) => ({
  id: String(u._id),
  studentId: u.studentId,
  email: u.email,
  role: u.role,
  profile: u.profile,
});

/** Same shape as driver login — used when /api/auth/login falls back to Driver collection. */
const sanitizeDriverAsUser = (driver) => ({
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

const sendSignupOtp = async (req, res) => {
  try {
    clearExpiredOtp();
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const alreadyUser = isDbConnected()
      ? await User.findOne(emailMatchExpr(email))
      : await findUserByEmail(email);
    if (alreadyUser) {
      return res.status(409).json({ message: "This email already has a passenger account" });
    }

    const otp = createOtp();
    const ttl = otpTtlMs();
    signupOtpStore.set(email, { otp, expiresAt: Date.now() + ttl });
    verifiedSignupEmailStore.delete(email);

    await sendMail({
      to: email,
      subject: "SLIIT Transport - Signup OTP",
      text: `Your OTP is ${otp}. It expires in ${Math.round(ttl / 60000)} minutes.`,
      html: `<p>Your signup OTP is <b>${otp}</b>.</p><p>This code expires in ${Math.round(ttl / 60000)} minutes.</p>`,
    });

    return res.json({ message: "OTP sent successfully" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const verifySignupOtp = async (req, res) => {
  try {
    clearExpiredOtp();
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? "").trim();
    if (!email || !otp) {
      return res.status(400).json({ message: "email and otp are required" });
    }
    const rec = signupOtpStore.get(email);
    if (!rec || Number(rec.expiresAt) <= Date.now()) {
      signupOtpStore.delete(email);
      return res.status(400).json({ message: "OTP expired. Request a new OTP." });
    }
    if (String(rec.otp) !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    signupOtpStore.delete(email);
    verifiedSignupEmailStore.set(email, { expiresAt: Date.now() + otpTtlMs() });
    return res.json({ message: "OTP verified" });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

const register = async (req, res) => {
  try {
    const { studentId, email, password, role, profile } = req.body;
    if (!studentId || !email || !password) {
      return res.status(400).json({ message: "studentId, email, password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    if (isDbConnected()) {
      const normalizedEmail = normalizeEmail(email);
      if (String(role || "student").toLowerCase() === "student" && requireSignupOtp()) {
        clearExpiredOtp();
        const verified = verifiedSignupEmailStore.get(normalizedEmail);
        if (!verified || Number(verified.expiresAt) <= Date.now()) {
          return res.status(400).json({ message: "Verify signup OTP before creating the account" });
        }
      }
      const exists = await User.findOne({
        $or: [{ studentId: String(studentId).trim() }, emailMatchExpr(normalizedEmail)],
      });
      if (exists) return res.status(409).json({ message: "User already exists" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        studentId: String(studentId).trim(),
        email: normalizedEmail,
        passwordHash,
        role: role || "student",
        profile: {
          fullName: String(profile?.fullName ?? ""),
          phone: String(profile?.phone ?? ""),
          department: String(profile?.department ?? ""),
        },
      });
      await createAndEmitNotification(req, {
        userId: String(user._id),
        type: "auth",
        title: "Signup successful",
        message: "Your account was created successfully.",
        meta: { role: user.role, email: user.email },
      });
      verifiedSignupEmailStore.delete(normalizedEmail);

      return res.status(201).json({ message: "Registered successfully", user: sanitizeUser(user) });
    }

    // In-memory fallback
    const normalizedEmail = normalizeEmail(email);
    if (String(role || "student").toLowerCase() === "student" && requireSignupOtp()) {
      clearExpiredOtp();
      const verified = verifiedSignupEmailStore.get(normalizedEmail);
      if (!verified || Number(verified.expiresAt) <= Date.now()) {
        return res.status(400).json({ message: "Verify signup OTP before creating the account" });
      }
    }
    const memUser = await createUser({ studentId, email, password, role: role || "student", profile });
    await createAndEmitNotification(req, {
      userId: String(memUser._id),
      type: "auth",
      title: "Signup successful",
      message: "Your account was created successfully.",
      meta: { role: memUser.role, email: memUser.email },
    });
    verifiedSignupEmailStore.delete(normalizedEmail);
    return res.status(201).json({ message: "Registered successfully (memory)", user: sanitizeUser(memUser) });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email and password are required" });

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = isDbConnected()
      ? await User.findOne(emailMatchExpr(normalizedEmail))
      : await findUserByEmail(normalizedEmail);

    if (user) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) {
        // Same email can exist in Driver collection as well.
        // If passenger password fails, try driver account before rejecting.
        const driverForSameEmail = isDbConnected()
          ? await Driver.findOne(emailMatchExpr(normalizedEmail))
          : await findDriverByEmail(normalizedEmail);
        if (driverForSameEmail) {
          const driverOk = await bcrypt.compare(password, driverForSameEmail.passwordHash);
          if (driverOk) {
            const driverToken = signToken({ sub: driverForSameEmail._id, role: "driver" });
            await createAndEmitNotification(req, {
              userId: String(driverForSameEmail._id),
              type: "auth",
              title: "Login successful",
              message: "Driver login successful.",
              meta: { role: "driver", email: driverForSameEmail.email },
            });
            return res.json({
              message: "Login successful",
              token: driverToken,
              user: sanitizeDriverAsUser(driverForSameEmail),
              driver: {
                id: String(driverForSameEmail._id),
                email: driverForSameEmail.email,
                fullName: driverForSameEmail.fullName,
                phone: driverForSameEmail.phone,
                vehicleNumber: driverForSameEmail.vehicleNumber,
              },
            });
          }
        }
        return res.status(401).json({ message: "Incorrect password" });
      }
      const token = signToken({ sub: user._id, role: user.role });
      await createAndEmitNotification(req, {
        userId: String(user._id),
        type: "auth",
        title: "Login successful",
        message: "You logged in successfully.",
        meta: { role: user.role, email: user.email },
      });
      return res.json({ message: "Login successful", token, user: sanitizeUser(user) });
    }

    // Passenger account not found — try driver (accounts created on Driver tab live here).
    const driver = isDbConnected()
      ? await Driver.findOne(emailMatchExpr(normalizedEmail))
      : await findDriverByEmail(normalizedEmail);
    if (!driver) {
      return res.status(401).json({
        message:
          "No account for this email. Register on Sign up (passenger) or Driver tab, or check the email address.",
        code: "UNKNOWN_EMAIL",
      });
    }

    const driverOk = await bcrypt.compare(password, driver.passwordHash);
    if (!driverOk) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = signToken({ sub: driver._id, role: "driver" });
    await createAndEmitNotification(req, {
      userId: String(driver._id),
      type: "auth",
      title: "Login successful",
      message: "Driver login successful.",
      meta: { role: "driver", email: driver.email },
    });
    return res.json({
      message: "Login successful",
      token,
      user: sanitizeDriverAsUser(driver),
      driver: {
        id: String(driver._id),
        email: driver.email,
        fullName: driver.fullName,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

module.exports = { register, login, sendSignupOtp, verifySignupOtp };

