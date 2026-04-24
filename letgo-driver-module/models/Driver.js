const mongoose = require("mongoose");

const driverSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    licenseCategory: {
      type: String,
      default: "",
      trim: true,
    },
    licenseExpiry: {
      type: String,
      default: "",
      trim: true,
    },
    licenseDocumentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    vehicleBookDocumentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    vehiclePhotoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      default: "",
      trim: true,
    },
    currentVehicle: {
      type: String,
      default: "",
      trim: true,
    },
    showLocation: {
      type: Boolean,
      default: false,
    },
    availability: {
      type: Boolean,
      default: true,
    },
    /** Shown to passengers when they choose bank transfer (optional until driver fills them). */
    bankAccountName: { type: String, default: "", trim: true },
    bankName: { type: String, default: "", trim: true },
    bankAccountNumber: { type: String, default: "", trim: true },
    bankBranch: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Driver", driverSchema);
