const bcrypt = require("bcryptjs");

function createId(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

// In-memory fallback when MongoDB is disconnected.
// NOTE: This is for demo/dev only. Data resets when server restarts.
const memory = {
  usersByEmail: new Map(), // email -> user
  usersByStudentId: new Map(), // studentId -> user
  driversByEmail: new Map(), // email -> driver
};

async function createUser({ studentId, email, password, role = "student", profile = {} }) {
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedStudentId = String(studentId).trim();

  if (memory.usersByEmail.has(normalizedEmail) || memory.usersByStudentId.has(normalizedStudentId)) {
    const err = new Error("User already exists");
    err.code = 11000;
    throw err;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = {
    _id: createId("USR"),
    studentId: normalizedStudentId,
    email: normalizedEmail,
    passwordHash,
    role,
    otpCode: "",
    otpExpiresAt: null,
    profile: {
      fullName: String(profile?.fullName ?? ""),
      phone: String(profile?.phone ?? ""),
      department: String(profile?.department ?? ""),
    },
  };

  memory.usersByEmail.set(normalizedEmail, user);
  memory.usersByStudentId.set(normalizedStudentId, user);
  return user;
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).toLowerCase().trim();
  return memory.usersByEmail.get(normalizedEmail) ?? null;
}

async function createDriver({
  email,
  password,
  fullName,
  phone,
  licenseNumber,
  licenseCategory,
  licenseExpiry,
  vehicleNumber,
  licenseDocumentUrl = "",
  vehicleBookDocumentUrl = "",
  vehiclePhotoUrl = "",
}) {
  const normalizedEmail = String(email).toLowerCase().trim();
  if (memory.driversByEmail.has(normalizedEmail)) {
    const err = new Error("An account with this email already exists");
    err.code = 11000;
    throw err;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const driver = {
    _id: createId("DRV"),
    email: normalizedEmail,
    passwordHash,
    fullName: String(fullName).trim(),
    phone: String(phone).trim(),
    licenseNumber: String(licenseNumber).trim(),
    licenseCategory: String(licenseCategory ?? "").trim(),
    licenseExpiry: String(licenseExpiry ?? "").trim(),
    licenseDocumentUrl: String(licenseDocumentUrl || "").trim(),
    vehicleBookDocumentUrl: String(vehicleBookDocumentUrl || "").trim(),
    vehiclePhotoUrl: String(vehiclePhotoUrl || "").trim(),
    vehicleNumber: String(vehicleNumber).trim(),
    vehicleType: "",
    currentVehicle: String(vehicleNumber).trim(),
    showLocation: false,
    availability: true,
    bankAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    bankBranch: "",
  };

  memory.driversByEmail.set(normalizedEmail, driver);
  return driver;
}

function updateDriverLicenseDocument(driverId, licenseDocumentUrl) {
  for (const driver of memory.driversByEmail.values()) {
    if (String(driver._id) === String(driverId)) {
      driver.licenseDocumentUrl = String(licenseDocumentUrl);
      return driver;
    }
  }
  return null;
}

async function findDriverByEmail(email) {
  const normalizedEmail = String(email).toLowerCase().trim();
  return memory.driversByEmail.get(normalizedEmail) ?? null;
}

function findDriverById(driverId) {
  for (const driver of memory.driversByEmail.values()) {
    if (String(driver._id) === String(driverId)) return driver;
  }
  return null;
}

function updateDriverById(driverId, patch = {}) {
  const driver = findDriverById(driverId);
  if (!driver) return null;
  Object.assign(driver, patch);
  return driver;
}

module.exports = {
  memory,
  createUser,
  findUserByEmail,
  createDriver,
  findDriverByEmail,
  findDriverById,
  updateDriverById,
  updateDriverLicenseDocument,
};

