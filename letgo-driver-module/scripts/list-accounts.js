/**
 * List passenger (User) and driver accounts in MongoDB (email + id + role only).
 *
 *   cd letgo-driver-module
 *   node scripts/list-accounts.js
 *
 * Requires MONGO_URI in .env
 */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Driver = require("../models/Driver");

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGO_URI in .env first.");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const users = await User.find({})
    .select("email studentId role createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const drivers = await Driver.find({})
    .select("email fullName createdAt")
    .sort({ createdAt: -1 })
    .lean();

  console.log("\n=== Passengers (User collection) ===");
  if (!users.length) {
    console.log("(none)");
  } else {
    users.forEach((u) => {
      console.log(
        `  • ${u.email} | studentId: ${u.studentId} | role: ${u.role} | id: ${u._id}`
      );
    });
  }

  console.log("\n=== Drivers (Driver collection) ===");
  if (!drivers.length) {
    console.log("(none)");
  } else {
    drivers.forEach((d) => {
      console.log(`  • ${d.email} | ${d.fullName || ""} | id: ${d._id}`);
    });
  }

  console.log(`\nTotal: ${users.length} passenger(s), ${drivers.length} driver(s)\n`);
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
