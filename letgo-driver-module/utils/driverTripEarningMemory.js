/** In-memory trip completions when MongoDB is offline (same process as ride request memory). */
const rows = [];

function recordTripEarningMemory({ driverId, rideRequestId, fareLkr, routeLabel }) {
  const did = String(driverId || "").trim();
  const rid = String(rideRequestId || "").trim();
  if (!did || !rid) return;
  const fare = Math.round(Number(fareLkr) || 0);
  const idx = rows.findIndex((r) => r.driverId === did && r.rideRequestId === rid);
  const row = {
    driverId: did,
    rideRequestId: rid,
    fareLkr: fare,
    routeLabel: String(routeLabel || "").slice(0, 160),
    completedAt: new Date(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
}
//list trip earnings memory
function listTripEarningsMemory(driverId) {
  const did = String(driverId || "").trim();
  return rows.filter((r) => r.driverId === did);
}

module.exports = { recordTripEarningMemory, listTripEarningsMemory };
