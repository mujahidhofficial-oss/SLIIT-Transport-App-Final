const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "driver", "admin"], default: "student" },
    otpCode: { type: String, default: "" },
    otpExpiresAt: { type: Date, default: null },
    profile: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      department: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);

