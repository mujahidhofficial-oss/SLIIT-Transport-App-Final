const crypto = require("crypto");

/** token -> { absPath, norm, exp } — pending license file after successful /verify-license */
const pending = new Map();

const TTL_MS = 15 * 60 * 1000;

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of pending.entries()) {
    if (v.exp < now) pending.delete(k);
  }
}

function issuePendingLicense(absPath, licenseNorm) {
  pruneExpired();
  const token = crypto.randomBytes(24).toString("hex");
  pending.set(token, {
    absPath,
    norm: String(licenseNorm),
    exp: Date.now() + TTL_MS,
  });
  return token;
}

/**
 * Validates token + that submitted license number still matches; consumes token.
 * @returns {null | { absPath: string }}
 */
function takePending(token, licenseNumberNormalized) {
  pruneExpired();
  const t = String(token ?? "").trim();
  if (!t) return null;
  const rec = pending.get(t);
  if (!rec || rec.exp < Date.now()) {
    if (rec) pending.delete(t);
    return null;
  }
  if (String(rec.norm) !== String(licenseNumberNormalized)) return null;
  pending.delete(t);
  return { absPath: rec.absPath };
}

module.exports = {
  issuePendingLicense,
  takePending,
  pruneExpired,
};
