/**
 * Create a passenger user in MongoDB when the DB is empty or you need a test account.
 *
 * Usage (from letgo-driver-module folder):
 *   node scripts/seed-passenger.js [email] [password] [studentId]
 *
 * Example:
 *   node scripts/seed-passenger.js hs@gmail.com mendaka IT123456
 *
 * Requires MONGO_URI in .env
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { emailMatchExpr } = require("../utils/emailLookup");

const email = String(process.argv[2] || "hs@gmail.com")
  .toLowerCase()
  .trim();
const password = String(process.argv[3] || "changeme123");
const studentId = String(process.argv[4] || `SEED-${Date.now().toString(36)}`).trim();

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGO_URI in .env (MongoDB is required for this script).");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const existing = await User.findOne(emailMatchExpr(email));
  if (existing) {
    console.log("Passenger already exists for:", email);
    await mongoose.disconnect();
    process.exit(0);
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    studentId,
    email,
    passwordHash,
    role: "student",
    profile: { fullName: "Seeded passenger", phone: "", department: "" },
  });
  console.log("Created passenger:", email, "| studentId:", studentId);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
