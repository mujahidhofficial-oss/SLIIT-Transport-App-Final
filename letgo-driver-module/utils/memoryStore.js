const { computeDynamicPricePerSeat } = require("./dynamicPricing");

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

// In-memory fallback for demo when MongoDB is disconnected.
const memory = {
  trips: new Map(), // id -> trip
  bookings: new Map(), // id -> booking
};

function seedTripsIfEmpty() {
  if (memory.trips.size > 0) return;
  const now = Date.now();

  const t1Id = createId("trip");
  memory.trips.set(t1Id, {
    _id: t1Id,
    driverId: "driver_demo_1",
    pickupLocation: "Main Gate",
    destination: "SLIIT Malabe",
    departureTime: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    seatLimit: 4,
    availableSeats: 4,
    pricePerSeat: 1200, // base price
    distanceKm: 4,
    status: "scheduled",
    trackingEnabled: false,
    isVisible: true,
    currentLocation: { lat: null, lng: null },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const t2Id = createId("trip");
  memory.trips.set(t2Id, {
    _id: t2Id,
    driverId: "driver_demo_2",
    pickupLocation: "Student Center",
    destination: "SLIIT Malabe",
    departureTime: new Date(now + 7 * 60 * 60 * 1000).toISOString(),
    seatLimit: 6,
    availableSeats: 6,
    pricePerSeat: 800,
    distanceKm: 3,
    status: "scheduled",
    trackingEnabled: false,
    isVisible: true,
    currentLocation: { lat: null, lng: null },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function getTripsForApi() {
  seedTripsIfEmpty();
  const trips = Array.from(memory.trips.values()).filter((t) => t.status === "scheduled" && t.isVisible);
  return trips
    .slice()
    .sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
    .map((t) => {
      const basePricePerSeat = Number(t.pricePerSeat);
      const dynamicPricePerSeat = computeDynamicPricePerSeat({ ...t, pricePerSeat: basePricePerSeat });
      return {
        ...t,
        basePricePerSeat,
        pricePerSeat: dynamicPricePerSeat,
      };
    });
}

function getTripById(id) {
  seedTripsIfEmpty();
  return memory.trips.get(id) || null;
}

function upsertTrip(trip) {
  memory.trips.set(trip._id, trip);
}

function createBooking({ tripId, customerId, seatNumbers, seatsRequested, totalAmount }) {
  const bookingId = createId("booking");
  const booking = {
    _id: bookingId,
    tripId,
    customerId,
    seatNumbers: Array.isArray(seatNumbers) ? seatNumbers : [],
    seatsRequested,
    totalAmount,
    status: "pending",
    paymentStatus: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memory.bookings.set(bookingId, booking);
  return booking;
}

function getBookingsForTrip(tripId) {
  return Array.from(memory.bookings.values()).filter((b) => String(b.tripId) === String(tripId));
}

function getBookingById(id) {
  return memory.bookings.get(id) || null;
}

function saveBooking(booking) {
  memory.bookings.set(booking._id, booking);
}

module.exports = {
  memory,
  getTripsForApi,
  getTripById,
  upsertTrip,
  createBooking,
  getBookingsForTrip,
  getBookingById,
  saveBooking,
};

