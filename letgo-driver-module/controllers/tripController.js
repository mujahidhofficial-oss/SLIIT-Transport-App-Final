const Trip = require("../models/Trip");
const Booking = require("../models/Booking");
const mongoose = require("mongoose");
const { processPayment } = require("../utils/paymentSimulator");
const { computeDynamicPricePerSeat } = require("../utils/dynamicPricing");
const memoryStore = require("../utils/memoryStore");

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

function emitIfIo(req, event, payload) {
  const io = req?.app?.get("io");
  if (io) io.emit(event, payload);
}

// Create trip
const createTrip = async (req, res) => {
  try {
    const {
      driverId,
      pickupLocation,
      destination,
      departureTime,
      seatLimit,
      pricePerSeat
    } = req.body;

    if (!driverId || !pickupLocation || !destination || !departureTime) {
      return res.status(400).json({ message: "Missing required trip fields" });
    }

    if (Number(seatLimit) <= 0 || Number(pricePerSeat) <= 0) {
      return res.status(400).json({ message: "Seat limit and price must be greater than zero" });
    }

    if (new Date(departureTime).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Departure time must be in the future" });
    }

    if (!isDbConnected()) {
      const id = `trip_mem_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const trip = {
        _id: id,
        driverId,
        pickupLocation,
        destination,
        departureTime: new Date(departureTime).toISOString(),
        seatLimit: Number(seatLimit),
        availableSeats: Number(seatLimit),
        pricePerSeat: Number(pricePerSeat),
        basePricePerSeat: Number(pricePerSeat),
        distanceKm: 0,
        status: "scheduled",
        trackingEnabled: false,
        isVisible: true,
        currentLocation: { lat: null, lng: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.upsertTrip(trip);
      return res.status(201).json({ message: "Trip created successfully (memory)", trip });
    }

    const trip = await Trip.create({
      driverId,
      pickupLocation,
      destination,
      departureTime,
      seatLimit: Number(seatLimit),
      availableSeats: Number(seatLimit),
      pricePerSeat: Number(pricePerSeat),
    });

    res.status(201).json({
      message: "Trip created successfully",
      trip
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get visible trips
const getAllVisibleTrips = async (req, res) => {
  try {
    if (!isDbConnected()) {
      return res.status(200).json(memoryStore.getTripsForApi());
    }
    const trips = await Trip.find({ status: "scheduled", isVisible: true }).sort({ departureTime: 1 });
    const mapped = trips.map((t) => {
      const basePricePerSeat = Number(t.pricePerSeat);
      const dynamicPricePerSeat = computeDynamicPricePerSeat({ ...t.toObject(), pricePerSeat: basePricePerSeat });
      return {
        ...t.toObject(),
        basePricePerSeat,
        pricePerSeat: dynamicPricePerSeat,
      };
    });
    res.status(200).json(mapped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Start trip
const startTrip = async (req, res) => {
  try {
    if (!isDbConnected()) {
      const trip = memoryStore.getTripById(req.params.tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (trip.status !== "scheduled") return res.status(400).json({ message: "Only scheduled trips can be started" });
      trip.status = "started";
      trip.trackingEnabled = true;
      trip.updatedAt = new Date();
      memoryStore.upsertTrip(trip);
      return res.status(200).json({ message: "Trip started. Real-time tracking enabled.", trip });
    }
    const trip = await Trip.findById(req.params.tripId);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.status !== "scheduled") {
      return res.status(400).json({ message: "Only scheduled trips can be started" });
    }

    trip.status = "started";
    trip.trackingEnabled = true;
    await trip.save();

    res.status(200).json({
      message: "Trip started. Real-time tracking enabled.",
      trip
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update live location
const updateTripLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!isDbConnected()) {
      const trip = memoryStore.getTripById(req.params.tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (trip.status !== "started") return res.status(400).json({ message: "Trip has not started yet" });
      trip.currentLocation = { lat, lng };
      trip.updatedAt = new Date();
      memoryStore.upsertTrip(trip);
      emitIfIo(req, `tripLocation:${trip._id}`, {
        tripId: trip._id,
        currentLocation: trip.currentLocation,
      });
      return res.status(200).json({ message: "Trip location updated", currentLocation: trip.currentLocation });
    }

    const trip = await Trip.findById(req.params.tripId);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.status !== "started") {
      return res.status(400).json({ message: "Trip has not started yet" });
    }

    if (!trip.trackingEnabled) {
      return res.status(400).json({ message: "Tracking is not enabled for this trip" });
    }

    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ message: "Latitude and longitude must be numeric" });
    }

    trip.currentLocation = { lat, lng };
    await trip.save();

    const io = req.app.get("io");
    if (io) {
      io.emit(`tripLocation:${trip._id}`, {
        tripId: trip._id,
        currentLocation: trip.currentLocation
      });
    }

    res.status(200).json({
      message: "Trip location updated",
      currentLocation: trip.currentLocation
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// End trip
const endTrip = async (req, res) => {
  try {
    if (!isDbConnected()) {
      const trip = memoryStore.getTripById(req.params.tripId);
      if (!trip) return res.status(404).json({ message: "Trip not found" });
      if (trip.status !== "started") return res.status(400).json({ message: "Only started trips can be ended" });

      trip.status = "ended";
      trip.trackingEnabled = false;
      trip.updatedAt = new Date();
      memoryStore.upsertTrip(trip);

      const acceptedBookings = memoryStore
        .getBookingsForTrip(trip._id)
        .filter((b) => b.status === "accepted");

      const paymentResults = [];

      for (const booking of acceptedBookings) {
        const payment = await processPayment(booking.totalAmount);
        if (payment.success) {
          booking.status = "paid";
          booking.paymentStatus = "completed";
          booking.updatedAt = new Date();
          memoryStore.saveBooking(booking);

          emitIfIo(req, "bookingStatusUpdate", {
            bookingId: String(booking._id),
            tripId: String(trip._id),
            status: "paid",
          });
        }

        paymentResults.push({
          bookingId: booking._id,
          customerId: booking.customerId,
          amount: booking.totalAmount,
          paymentStatus: booking.paymentStatus,
        });
      }

      return res.status(200).json({
        message: "Trip ended. Payments processed and seats updated.",
        trip,
        payments: paymentResults,
      });
    }

    const trip = await Trip.findById(req.params.tripId);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    if (trip.status !== "started") {
      return res.status(400).json({ message: "Only started trips can be ended" });
    }

    trip.status = "ended";
    trip.trackingEnabled = false;
    await trip.save();

    const acceptedBookings = await Booking.find({
      tripId: trip._id,
      status: "accepted"
    });

    const paymentResults = [];

    for (const booking of acceptedBookings) {
      const payment = await processPayment(booking.totalAmount);

      if (payment.success) {
        booking.status = "paid";
        booking.paymentStatus = "completed";
        await booking.save();

        emitIfIo(req, "bookingStatusUpdate", {
          bookingId: String(booking._id),
          tripId: String(trip._id),
          status: "paid",
        });
      }

      paymentResults.push({
        bookingId: booking._id,
        customerId: booking.customerId,
        amount: booking.totalAmount,
        paymentStatus: booking.paymentStatus
      });
    }

    res.status(200).json({
      message: "Trip ended. Payments processed and seats updated.",
      trip,
      payments: paymentResults
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createTrip,
  getAllVisibleTrips,
  startTrip,
  updateTripLocation,
  endTrip
};
