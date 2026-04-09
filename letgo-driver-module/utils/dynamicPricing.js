/**
 * Dynamic pricing MVP:
 * - demand: based on occupancy (1 - availableSeats/seatLimit)
 * - time: based on how soon departure is (depart within 24h => higher)
 * - distance: optional if driver provides trip.distanceKm
 *
 * Returns effective price per seat, capped to avoid runaway prices.
 */

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function computeDynamicPricePerSeat(trip) {
  const basePrice = Number(trip.pricePerSeat);
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;

  const seatLimit = Number(trip.seatLimit ?? trip.seatLimit);
  const availableSeats = Number(trip.availableSeats);

  const demandFactor = seatLimit > 0 ? clamp01((seatLimit - availableSeats) / seatLimit) : 0;

  const departureMs = new Date(trip.departureTime).getTime();
  const nowMs = Date.now();
  const minutesUntil = Math.max(0, departureMs - nowMs) / 60000;

  // Within 24 hours => timeFactor approaches 1.
  const timeFactor = clamp01((1440 - minutesUntil) / 1440);

  const distanceKm = Number(trip.distanceKm ?? 0);
  // Assume 10km as a soft normalization point.
  const distanceFactor = clamp01(distanceKm / 10);

  // Weights tuned for MVP presentation.
  const demandWeight = 0.7;
  const timeWeight = 0.35;
  const distanceWeight = 0.15;

  const raw = basePrice * (1 + demandWeight * demandFactor + timeWeight * timeFactor + distanceWeight * distanceFactor);
  const maxPrice = basePrice * 2.0; // cap to 2x base for safety
  return Math.min(raw, maxPrice);
}

module.exports = { computeDynamicPricePerSeat };

