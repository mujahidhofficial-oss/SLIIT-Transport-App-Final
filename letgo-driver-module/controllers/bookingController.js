const Booking = require("../models/Booking");
const Trip = require("../models/Trip");
const mongoose = require("mongoose");
const { computeDynamicPricePerSeat } = require("../utils/dynamicPricing");
const memoryStore = require("../utils/memoryStore");
const { createAndEmitNotification } = require("../utils/notify");
// Helper to emit socket events if io is available in app context.
function emitIfIo(req, event, payload) {
  const io = req.app.get("io");
  if (io) io.emit(event, payload);
}
// Helper to check if DB is connected, used to decide between in-memory store and MongoDB.
function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

// Create booking request
const createBookingRequest = async (req, res) => {
  try {
    const { tripId, customerId, seatsRequested, seatNumbers } = req.body;

    const parsedSeatNumbers = Array.isArray(seatNumbers)
      ? seatNumbers.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    const parsedSeatsRequested = parsedSeatNumbers.length > 0 ? parsedSeatNumbers.length : Number(seatsRequested);

    if (!tripId || !customerId || Number(parsedSeatsRequested) <= 0) {
      return res.status(400).json({ message: "Invalid booking request data" });
    }

    if (!isDbConnected()) {
      const trip = memoryStore.getTripById(tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (trip.status !== "scheduled") {
        return res.status(400).json({ message: "Bookings are allowed only for scheduled trips" });
      }
      if (trip.availableSeats < Number(parsedSeatsRequested)) {
        return res.status(400).json({ message: "Not enough available seats for request" });
      }
// Check for existing open booking for the same customer and trip.
      const existingOpenBooking = memoryStore
        .getBookingsForTrip(tripId)
        .find((b) => String(b.customerId) === String(customerId) && ["pending", "accepted"].includes(b.status));
      if (existingOpenBooking) {
        return res.status(400).json({ message: "Customer already has an active booking for this trip" });
      }

      const effectivePricePerSeat = computeDynamicPricePerSeat(trip);
      const totalAmount = Number(parsedSeatsRequested) * effectivePricePerSeat;

      trip.availableSeats -= Number(parsedSeatsRequested);
      trip.updatedAt = new Date();
      memoryStore.upsertTrip(trip);

      const booking = memoryStore.createBooking({
        tripId,
        customerId,
        seatNumbers: parsedSeatNumbers,
        seatsRequested: Number(parsedSeatsRequested),
        totalAmount,
      });

      emitIfIo(req, "tripSeatsUpdate", {
        tripId: String(trip._id),
        availableSeats: trip.availableSeats,
        seatsTotal: trip.seatLimit,
        pricePerSeat: effectivePricePerSeat,
      });

      emitIfIo(req, "bookingStatusUpdate", {
        bookingId: String(booking._id),
        tripId: String(trip._id),
        status: "pending",
      });
      await createAndEmitNotification(req, {
        userId: String(customerId),
        type: "booking",
        title: "Booking created",
        message: "Your booking request is pending driver confirmation.",
        meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "pending" },
      });
      await createAndEmitNotification(req, {
        userId: String(trip.driverId),
        type: "booking",
        title: "New booking request",
        message: "You received a new booking request. Please accept or decline it.",
        meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "pending" },
      });

      return res.status(201).json({
        message: "Booking request sent successfully",
        booking,
      });
    }

    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.status !== "scheduled") {
      return res.status(400).json({ message: "Bookings are allowed only for scheduled trips" });
    }

    if (trip.availableSeats < Number(parsedSeatsRequested)) {
      return res.status(400).json({ message: "Not enough available seats for request" });
    }

    const existingOpenBooking = await Booking.findOne({
      tripId,
      customerId,
      status: { $in: ["pending", "accepted"] }
    });

    if (existingOpenBooking) {
      return res.status(400).json({ message: "Customer already has an active booking for this trip" });
    }

    // Dynamic pricing snapshot at booking request time.
    const effectivePricePerSeat = computeDynamicPricePerSeat(trip);
    const totalAmount = Number(parsedSeatsRequested) * effectivePricePerSeat;

    // Seat management: reserve seats immediately when booking request is created.
    trip.availableSeats -= Number(parsedSeatsRequested);
    await trip.save();

    const booking = await Booking.create({
      tripId,
      customerId,
      seatNumbers: parsedSeatNumbers,
      seatsRequested: Number(parsedSeatsRequested),
      totalAmount,
      status: "pending",
    });

    emitIfIo(req, "tripSeatsUpdate", {
      tripId: String(trip._id),
      availableSeats: trip.availableSeats,
      seatsTotal: trip.seatLimit,
      pricePerSeat: effectivePricePerSeat,
    });

    emitIfIo(req, "bookingStatusUpdate", {
      bookingId: String(booking._id),
      tripId: String(trip._id),
      status: "pending",
    });
    await createAndEmitNotification(req, {
      userId: String(customerId),
      type: "booking",
      title: "Booking created",
      message: "Your booking request is pending driver confirmation.",
      meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "pending" },
    });
    await createAndEmitNotification(req, {
      userId: String(trip.driverId),
      type: "booking",
      title: "New booking request",
      message: "You received a new booking request. Please accept or decline it.",
      meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "pending" },
    });

    res.status(201).json({
      message: "Booking request sent successfully",
      booking
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get bookings for a trip
const getBookingsForTrip = async (req, res) => {
  try {
    if (!isDbConnected()) {
      const bookings = memoryStore.getBookingsForTrip(req.params.tripId);
      return res.status(200).json(bookings);
    }
    const bookings = await Booking.find({ tripId: req.params.tripId }).sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Booking history (customer): returns bookings along with trip details.
const getBookingHistory = async (req, res) => {
  try {
    const customerId = req.query.customerId;
    if (!customerId) return res.status(400).json({ message: "customerId is required" });

    if (!isDbConnected()) {
      const allBookings = Array.from(memoryStore.memory.bookings.values()).filter(
        (b) => String(b.customerId) === String(customerId)
      );

      const payload = allBookings.map((b) => {
        const trip = memoryStore.getTripById(b.tripId);
        const effectivePrice = trip ? computeDynamicPricePerSeat({ ...trip }) : 0;
        return {
          booking: b,
          trip: trip
            ? {
                id: String(trip._id),
                from: trip.pickupLocation,
                to: trip.destination,
                departureTime: trip.departureTime,
                time: trip.departureTime,
                seatsTotal: trip.seatLimit,
                seatsAvailable: trip.availableSeats,
                pricePerSeat: effectivePrice,
              }
            : null,
        };
      });

      return res.json(payload);
    }

    const bookings = await Booking.find({ customerId: String(customerId) })
      .populate("tripId")
      .sort({ createdAt: -1 });

    const payload = bookings.map((b) => {
      const trip = b.tripId;
      const effectivePrice = trip ? computeDynamicPricePerSeat(trip) : 0;
      return {
        booking: b,
        trip: trip
          ? {
              id: String(trip._id),
              from: trip.pickupLocation,
              to: trip.destination,
              departureTime: trip.departureTime,
              time: trip.departureTime,
              seatsTotal: trip.seatLimit,
              seatsAvailable: trip.availableSeats,
              pricePerSeat: effectivePrice,
            }
          : null,
      };
    });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Driver analytics dashboard (MVP): revenue + occupancy.
const getDriverAnalytics = async (req, res) => {
  try {
    const driverId = req.params.driverId;
    if (!driverId) return res.status(400).json({ message: "driverId is required" });

    if (!isDbConnected()) {
      const trips = Array.from(memoryStore.memory.trips.values()).filter(
        (t) => String(t.driverId) === String(driverId) && t.status === "ended"
      );
      const tripIds = new Set(trips.map((t) => String(t._id)));

      const bookings = Array.from(memoryStore.memory.bookings.values()).filter(
        (b) => tripIds.has(String(b.tripId)) && b.status === "paid" && b.paymentStatus === "completed"
      );

      const revenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
      const bookedSeats = bookings.reduce((sum, b) => sum + Number(b.seatsRequested ?? 0), 0);
      const capacity = trips.reduce((sum, t) => sum + Number(t.seatLimit ?? 0), 0);
      const occupancyRate = capacity > 0 ? bookedSeats / capacity : 0;

      return res.json({
        driverId,
        revenue,
        occupancyRate,
        completedBookings: bookings.length,
        completedTrips: trips.length,
      });
    }

    const trips = await Trip.find({ driverId: String(driverId), status: "ended" }).select("_id seatLimit");
    const tripIds = trips.map((t) => t._id);

    const bookings = await Booking.find({
      tripId: { $in: tripIds },
      status: "paid",
      paymentStatus: "completed",
    });

    const revenue = bookings.reduce((sum, b) => sum + Number(b.totalAmount ?? 0), 0);
    const bookedSeats = bookings.reduce((sum, b) => sum + Number(b.seatsRequested ?? 0), 0);
    const capacity = trips.reduce((sum, t) => sum + Number(t.seatLimit ?? 0), 0);
    const occupancyRate = capacity > 0 ? bookedSeats / capacity : 0;

    res.json({
      driverId,
      revenue,
      occupancyRate,
      completedBookings: bookings.length,
      completedTrips: trips.length,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Respond to booking (accept/decline)
const respondToBooking = async (req, res) => {
  try {
    const { action } = req.body; // accepted or declined

    if (!isDbConnected()) {
      const booking = memoryStore.getBookingById(req.params.bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      const trip = memoryStore.getTripById(booking.tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (booking.status !== "pending") return res.status(400).json({ message: "Only pending bookings can be updated" });
      if (trip.status !== "scheduled") return res.status(400).json({ message: "Booking decisions are allowed only before trip starts" });

      if (action === "accepted") {
        booking.status = "accepted";
      } else if (action === "declined") {
        booking.status = "declined";
        trip.availableSeats += booking.seatsRequested;
        trip.updatedAt = new Date();
        memoryStore.upsertTrip(trip);
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      memoryStore.saveBooking(booking);

      emitIfIo(req, "tripSeatsUpdate", {
        tripId: String(trip._id),
        availableSeats: trip.availableSeats,
        seatsTotal: trip.seatLimit,
        pricePerSeat: computeDynamicPricePerSeat(trip),
      });

      emitIfIo(req, "bookingStatusUpdate", {
        bookingId: String(booking._id),
        tripId: String(trip._id),
        status: booking.status,
      });
      await createAndEmitNotification(req, {
        userId: String(booking.customerId),
        type: "booking",
        title: `Booking ${booking.status}`,
        message:
          booking.status === "accepted"
            ? "Your booking was accepted by the driver."
            : "Your booking was declined by the driver.",
        meta: { bookingId: String(booking._id), tripId: String(trip._id), status: booking.status },
      });

      return res.status(200).json({
        message: `Booking ${action} successfully`,
        booking,
        remainingSeats: trip.availableSeats,
      });
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const trip = await Trip.findById(booking.tripId);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: "Only pending bookings can be updated" });
    }

    if (trip.status !== "scheduled") {
      return res.status(400).json({ message: "Booking decisions are allowed only before trip starts" });
    }

    if (action === "accepted") {
      // Seats were already reserved when the booking request was created.
      booking.status = "accepted";
    } else if (action === "declined") {
      booking.status = "declined";
      // Restore seats on decline.
      trip.availableSeats += booking.seatsRequested;
      await trip.save();
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await booking.save();

    emitIfIo(req, "tripSeatsUpdate", {
      tripId: String(trip._id),
      availableSeats: trip.availableSeats,
      seatsTotal: trip.seatLimit,
      pricePerSeat: computeDynamicPricePerSeat(trip),
    });

    emitIfIo(req, "bookingStatusUpdate", {
      bookingId: String(booking._id),
      tripId: String(trip._id),
      status: booking.status,
    });
    await createAndEmitNotification(req, {
      userId: String(booking.customerId),
      type: "booking",
      title: `Booking ${booking.status}`,
      message:
        booking.status === "accepted"
          ? "Your booking was accepted by the driver."
          : "Your booking was declined by the driver.",
      meta: { bookingId: String(booking._id), tripId: String(trip._id), status: booking.status },
    });

    res.status(200).json({
      message: `Booking ${action} successfully`,
      booking,
      remainingSeats: trip.availableSeats,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Cancel booking (customer cancellation): restore seats automatically.
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!isDbConnected()) {
      const booking = memoryStore.getBookingById(bookingId);
      if (!booking) return res.status(404).json({ message: "Booking not found" });
      if (!["pending", "accepted"].includes(booking.status)) {
        return res.status(400).json({ message: "Only pending/accepted bookings can be cancelled" });
      }
      const trip = memoryStore.getTripById(booking.tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (trip.status !== "scheduled") {
        return res.status(400).json({ message: "Cancellation is allowed only before trip starts" });
      }

      trip.availableSeats = Math.min(trip.seatLimit, trip.availableSeats + booking.seatsRequested);
      trip.updatedAt = new Date();
      memoryStore.upsertTrip(trip);

      booking.status = "cancelled";
      booking.updatedAt = new Date();
      memoryStore.saveBooking(booking);

      emitIfIo(req, "tripSeatsUpdate", {
        tripId: String(trip._id),
        availableSeats: trip.availableSeats,
        seatsTotal: trip.seatLimit,
        pricePerSeat: computeDynamicPricePerSeat(trip),
      });

      emitIfIo(req, "bookingStatusUpdate", {
        bookingId: String(booking._id),
        tripId: String(trip._id),
        status: "cancelled",
      });
      await createAndEmitNotification(req, {
        userId: String(booking.customerId),
        type: "booking",
        title: "Booking cancelled",
        message: "Your booking was cancelled.",
        meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "cancelled" },
      });

      return res.json({ message: "Booking cancelled", booking, remainingSeats: trip.availableSeats });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    // Only allow cancellation before trip starts and only if seats were reserved.
    if (!["pending", "accepted"].includes(booking.status)) {
      return res.status(400).json({ message: "Only pending/accepted bookings can be cancelled" });
    }

    const trip = await Trip.findById(booking.tripId);
    if (!trip) return res.status(404).json({ message: "Trip not found" });
    if (trip.status !== "scheduled") {
      return res.status(400).json({ message: "Cancellation is allowed only before trip starts" });
    }

    trip.availableSeats = Math.min(trip.seatLimit, trip.availableSeats + booking.seatsRequested);
    await trip.save();

    booking.status = "cancelled";
    await booking.save();

    emitIfIo(req, "tripSeatsUpdate", {
      tripId: String(trip._id),
      availableSeats: trip.availableSeats,
      seatsTotal: trip.seatLimit,
      pricePerSeat: computeDynamicPricePerSeat(trip),
    });

    emitIfIo(req, "bookingStatusUpdate", {
      bookingId: String(booking._id),
      tripId: String(trip._id),
      status: "cancelled",
    });
    await createAndEmitNotification(req, {
      userId: String(booking.customerId),
      type: "booking",
      title: "Booking cancelled",
      message: "Your booking was cancelled.",
      meta: { bookingId: String(booking._id), tripId: String(trip._id), status: "cancelled" },
    });

    res.json({ message: "Booking cancelled", booking, remainingSeats: trip.availableSeats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBookingRequest,
  getBookingsForTrip,
  respondToBooking,
  cancelBooking,
  getBookingHistory,
  getDriverAnalytics,
};
