const crypto = require("crypto");

/** token -> { absPath, norm, exp } — pending vehicle book image after successful /verify-vehicle-book */
const pending = new Map();

const TTL_MS = 15 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of pending.entries()) {
    if (v.exp < now) pending.delete(k);
  }
}

function issuePendingVehicleBook(absPath, vehicleNorm) {
  pruneExpired();
  const token = crypto.randomBytes(24).toString("hex");
  pending.set(token, {
    absPath,
    norm: String(vehicleNorm),
    exp: Date.now() + TTL_MS,
  });
  return token;
}

function takePendingVehicleBook(token, vehicleNumberNormalized) {
  pruneExpired();
  const t = String(token ?? "").trim();
  if (!t) return null;
  const rec = pending.get(t);
  if (!rec || rec.exp < Date.now()) {
    if (rec) pending.delete(t);
    return null;
  }
  if (String(rec.norm) !== String(vehicleNumberNormalized)) return null;
  pending.delete(t);
  return { absPath: rec.absPath };
}

module.exports = {
  issuePendingVehicleBook,
  takePendingVehicleBook,
  pruneExpired,
};
