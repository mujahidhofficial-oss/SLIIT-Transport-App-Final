const mongoose = require("mongoose");
const RideRequest = require("../models/RideRequest");
const Driver = require("../models/Driver");
const DriverTripEarning = require("../models/DriverTripEarning");
const { verifyToken } = require("../config/auth");
const { recordTripEarningMemory } = require("../utils/driverTripEarningMemory");
const { findDriverById } = require("../utils/authMemoryStore");

const isDbConnected = () => mongoose.connection?.readyState === 1;
const memoryRideRequests = [];
let memorySeq = 1;

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function estimateFareLkr(distanceKm) {
  const km = Math.max(0, Number(distanceKm) || 0);
  const base = 150;
  const perKm = 80;
  return Math.round(base + km * perKm);
}

async function createRideRequest(req, res) {
  try {
    const { customerId, pickup, dropoff } = req.body || {};
    if (!customerId) return res.status(400).json({ message: "customerId is required" });
    if (!pickup?.lat || !pickup?.lng) return res.status(400).json({ message: "pickup lat/lng required" });
    if (!dropoff?.lat || !dropoff?.lng) return res.status(400).json({ message: "dropoff lat/lng required" });

    const distanceKm = haversineKm({ lat: pickup.lat, lng: pickup.lng }, { lat: dropoff.lat, lng: dropoff.lng });
    const estimatedFareLkr = estimateFareLkr(distanceKm);

    let doc;
    if (isDbConnected()) {
      doc = await RideRequest.create({
        customerId: String(customerId).trim(),
        pickup: {
          address: String(pickup.address ?? "").trim(),
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },
        dropoff: {
          address: String(dropoff.address ?? "").trim(),
          lat: Number(dropoff.lat),
          lng: Number(dropoff.lng),
        },
        distanceKm,
        estimatedFareLkr,
        status: "pending",
      });
    } else {
      doc = {
        _id: `mem_rr_${memorySeq++}`,
        customerId: String(customerId).trim(),
        pickup: {
          address: String(pickup.address ?? "").trim(),
          lat: Number(pickup.lat),
          lng: Number(pickup.lng),
        },
        dropoff: {
          address: String(dropoff.address ?? "").trim(),
          lat: Number(dropoff.lat),
          lng: Number(dropoff.lng),
        },
        distanceKm,
        estimatedFareLkr,
        status: "pending",
        driverId: "",
        driverName: "",
        driverPhone: "",
        vehicleNumber: "",
        vehicleType: "",
        driverBidLkr: 0,
        driverBidDriverId: "",
        driverBidDriverName: "",
        passengerBidResponse: "none",
        driverAtPickup: false,
        driverAtPickupAt: null,
        createdAt: new Date().toISOString(),
      };
      memoryRideRequests.unshift(doc);
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("rideRequestCreated", {
        requestId: String(doc._id),
        status: doc.status,
        distanceKm: doc.distanceKm,
        estimatedFareLkr: doc.estimatedFareLkr,
      });
    }

    return res.status(201).json({
      message: "Ride request created",
      request: {
        id: String(doc._id),
        customerId: doc.customerId,
        pickup: doc.pickup,
        dropoff: doc.dropoff,
        distanceKm: doc.distanceKm,
        estimatedFareLkr: doc.estimatedFareLkr,
        status: doc.status,
        driverId: doc.driverId,
        driverName: doc.driverName,
        driverPhone: doc.driverPhone,
        vehicleNumber: doc.vehicleNumber,
        vehicleType: doc.vehicleType,
        createdAt: doc.createdAt,
        driverBidLkr: Number(doc.driverBidLkr) || 0,
        driverBidDriverName: doc.driverBidDriverName || "",
        driverBidDriverId: doc.driverBidDriverId || "",
        passengerBidResponse: doc.passengerBidResponse || "none",
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

function normPassengerBidResponse(doc) {
  const v = String(doc.passengerBidResponse || "none").toLowerCase();
  if (v === "accepted" || v === "declined") return v;
  return "none";
}

/** Final LKR amount passenger should pay: agreed bid if they accepted that driver’s offer, else app estimate. */
function fareLkrForPayment(doc) {
  const bid = Math.round(Number(doc.driverBidLkr) || 0);
  const accepted = normPassengerBidResponse(doc) === "accepted";
  const assigned = String(doc.driverId || "").trim();
  const bidder = String(doc.driverBidDriverId || "").trim();
  const bidMatchesAssignedDriver =
    !assigned || !bidder || assigned === bidder;
  if (accepted && bid > 0 && bidMatchesAssignedDriver) {
    return bid;
  }
  return Math.round(Number(doc.estimatedFareLkr) || 0);
}

async function submitDriverBid(req, res) {
  try {
    const { requestId } = req.params;
    const rawAmount = req.body?.bidAmountLkr ?? req.body?.amount;
    const amount = Math.round(Number(rawAmount));
    if (!requestId) return res.status(400).json({ message: "requestId is required" });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "bidAmountLkr must be a positive number (LKR)" });
    }

    let resolvedDriverId = String(req.body?.driverId ?? "").trim();
    if (!resolvedDriverId) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (token) {
        try {
          const payload = verifyToken(token);
          if (payload && payload.role === "driver" && payload.sub) {
            resolvedDriverId = String(payload.sub);
          }
        } catch (_) {
          /* ignore */
        }
      }
    }
    if (!resolvedDriverId) {
      return res.status(401).json({ message: "Sign in as a driver or send driverId with your token" });
    }

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });
    if (doc.status !== "pending") {
      return res.status(409).json({ message: "Bids are only allowed while the request is still waiting" });
    }

    let driverName = "";
    if (isDbConnected()) {
      const driver = await Driver.findById(resolvedDriverId).catch(() => null);
      if (driver) driverName = String(driver.fullName ?? "").trim();
    } else {
      const mem = findDriverById(resolvedDriverId);
      if (mem) driverName = String(mem.fullName ?? "").trim();
    }

    doc.driverBidLkr = amount;
    doc.driverBidDriverId = String(resolvedDriverId);
    doc.driverBidDriverName = driverName;
    doc.passengerBidResponse = "none";
    if (isDbConnected()) {
      await doc.save();
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("rideRequestBidUpdate", {
        requestId: String(doc._id),
        driverBidLkr: amount,
        driverBidDriverName: driverName,
        driverBidDriverId: String(resolvedDriverId),
        passengerBidResponse: "none",
      });
    }

    return res.json({
      message: "Bid sent — passenger will see your offer on their request screen.",
      request: {
        id: String(doc._id),
        driverBidLkr: amount,
        driverBidDriverName: driverName,
        driverBidDriverId: String(resolvedDriverId),
        status: doc.status,
        passengerBidResponse: "none",
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

/** Customer can fetch their request to recover driverId (e.g. before payment) if socket missed fields. */
async function getRideRequestById(req, res) {
  try {
    const { requestId } = req.params;
    const customerId = String(req.query.customerId || "").trim();
    const driverIdQuery = String(req.query.driverId || "").trim();
    if (!requestId) return res.status(400).json({ message: "requestId is required" });
    if (!customerId && !driverIdQuery) {
      return res.status(400).json({ message: "customerId or driverId is required" });
    }

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });
    const okCustomer = customerId && String(doc.customerId) === customerId;
    const okDriver = driverIdQuery && String(doc.driverId || "").trim() === driverIdQuery;
    if (!okCustomer && !okDriver) {
      return res.status(403).json({ message: "Not allowed to view this request" });
    }

    return res.json({
      id: String(doc._id),
      customerId: doc.customerId,
      status: doc.status,
      driverId: doc.driverId ? String(doc.driverId) : "",
      driverName: doc.driverName || "",
      estimatedFareLkr: doc.estimatedFareLkr,
      pickup: doc.pickup,
      dropoff: doc.dropoff,
      driverBidLkr: Number(doc.driverBidLkr) || 0,
      driverBidDriverName: doc.driverBidDriverName || "",
      driverBidDriverId: doc.driverBidDriverId ? String(doc.driverBidDriverId) : "",
      passengerBidResponse: normPassengerBidResponse(doc),
      fareToPayLkr: fareLkrForPayment(doc),
      driverAtPickup: !!doc.driverAtPickup,
      driverAtPickupAt: doc.driverAtPickupAt
        ? (doc.driverAtPickupAt.toISOString
            ? doc.driverAtPickupAt.toISOString()
            : String(doc.driverAtPickupAt))
        : "",
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

function pickupPayloadFromDoc(doc) {
  const at = doc.driverAtPickupAt;
  let atStr = "";
  if (at) {
    atStr = typeof at.toISOString === "function" ? at.toISOString() : String(at);
  }
  return { driverAtPickup: !!doc.driverAtPickup, driverAtPickupAt: atStr };
}

async function markDriverArrivedAtPickup(req, res) {
  try {
    const { requestId } = req.params;
    if (!requestId) return res.status(400).json({ message: "requestId is required" });

    let resolvedDriverId = String(req.body?.driverId ?? "").trim();
    if (!resolvedDriverId) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (token) {
        try {
          const payload = verifyToken(token);
          if (payload?.role === "driver" && payload.sub) {
            resolvedDriverId = String(payload.sub);
          }
        } catch (_) {
          /* ignore */
        }
      }
    }
    if (!resolvedDriverId) {
      return res.status(401).json({ message: "Sign in as a driver or send driverId" });
    }

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });
    if (doc.status !== "accepted") {
      return res.status(409).json({ message: "Only an accepted ride can be marked at pickup" });
    }
    if (String(doc.driverId || "").trim() !== String(resolvedDriverId).trim()) {
      return res.status(403).json({ message: "Only the assigned driver can mark arrival at pickup" });
    }

    if (doc.driverAtPickup) {
      const pickup = pickupPayloadFromDoc(doc);
      return res.json({
        message: "Already marked at pickup.",
        request: { id: String(doc._id), ...pickup },
      });
    }

    const now = new Date();
    doc.driverAtPickup = true;
    doc.driverAtPickupAt = isDbConnected() ? now : now.toISOString();
    if (isDbConnected()) {
      await doc.save();
    }

    const pickup = pickupPayloadFromDoc(doc);

    const io = req.app.get("io");
    if (io) {
      io.emit("rideRequestPickupUpdate", {
        requestId: String(doc._id),
        driverAtPickup: pickup.driverAtPickup,
        driverAtPickupAt: pickup.driverAtPickupAt,
      });
    }

    return res.json({
      message: "You’re marked at pickup — the passenger will see that you’ve arrived.",
      request: {
        id: String(doc._id),
        ...pickup,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function setPassengerBidResponse(req, res) {
  try {
    const { requestId } = req.params;
    const raw = String(req.body?.response ?? "").toLowerCase();
    if (raw !== "accepted" && raw !== "declined") {
      return res.status(400).json({ message: "response must be accepted or declined" });
    }

    let customerId = String(req.body?.customerId ?? "").trim();
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (token) {
      try {
        const payload = verifyToken(token);
        if (payload?.role === "driver") {
          return res.status(403).json({ message: "Only passengers can respond to a fare offer" });
        }
        if (payload?.sub) customerId = String(payload.sub);
      } catch (_) {
        return res.status(401).json({ message: "Invalid or expired session" });
      }
    }

    if (!customerId) return res.status(401).json({ message: "Sign in required" });

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });
    if (String(doc.customerId).trim() !== customerId) {
      return res.status(403).json({ message: "Not allowed to update this request" });
    }
    if (doc.status !== "pending") {
      return res.status(409).json({ message: "Fare reactions are only available while the request is open" });
    }
    if (raw === "accepted" && (!(Number(doc.driverBidLkr) > 0))) {
      return res.status(409).json({ message: "There is no driver fare offer to accept yet" });
    }

    doc.passengerBidResponse = raw;
    if (isDbConnected()) await doc.save();

    const io = req.app.get("io");
    if (io) {
      io.emit("rideRequestBidPassengerResponse", {
        requestId: String(doc._id),
        passengerBidResponse: raw,
        driverBidLkr: Number(doc.driverBidLkr) || 0,
        driverBidDriverId: doc.driverBidDriverId ? String(doc.driverBidDriverId) : "",
      });
    }

    return res.json({
      message:
        raw === "accepted"
          ? "The driver can see you’re OK with this fare."
          : "The driver can see you’re not interested in this offer.",
      request: {
        id: String(doc._id),
        passengerBidResponse: raw,
        driverBidLkr: Number(doc.driverBidLkr) || 0,
        status: doc.status,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

/** Customer: all ride requests (on-demand), newest first — for trip history. */
async function listMyRideRequests(req, res) {
  try {
    const customerId = String(req.query.customerId || "").trim();
    if (!customerId) return res.status(400).json({ message: "customerId is required" });

    let items = [];
    if (isDbConnected()) {
      items = await RideRequest.find({ customerId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    } else {
      items = memoryRideRequests
        .filter((r) => String(r.customerId).trim() === customerId)
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return tb - ta;
        })
        .slice(0, 100);
    }

    return res.json(
      items.map((doc) => ({
        id: String(doc._id),
        customerId: doc.customerId,
        pickup: doc.pickup,
        dropoff: doc.dropoff,
        distanceKm: doc.distanceKm,
        estimatedFareLkr: doc.estimatedFareLkr,
        status: doc.status,
        driverId: doc.driverId ? String(doc.driverId) : "",
        driverName: doc.driverName || "",
        driverPhone: doc.driverPhone || "",
        vehicleNumber: doc.vehicleNumber || "",
        vehicleType: doc.vehicleType || "",
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        driverBidLkr: Number(doc.driverBidLkr) || 0,
        driverBidDriverName: doc.driverBidDriverName || "",
        driverBidDriverId: doc.driverBidDriverId ? String(doc.driverBidDriverId) : "",
        passengerBidResponse: normPassengerBidResponse(doc),
        fareToPayLkr: fareLkrForPayment(doc),
        ...pickupPayloadFromDoc(doc),
      }))
    );
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

/** Driver: on-demand rides assigned to this driver (accepted / completed / etc.), newest first. */
async function listDriverRideRequests(req, res) {
  try {
    const driverId = String(req.query.driverId || "").trim();
    if (!driverId) return res.status(400).json({ message: "driverId is required" });

    let items = [];
    if (isDbConnected()) {
      items = await RideRequest.find({ driverId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    } else {
      items = memoryRideRequests
        .filter((r) => String(r.driverId || "").trim() === driverId)
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.createdAt || 0).getTime();
          const tb = new Date(b.createdAt || 0).getTime();
          return tb - ta;
        })
        .slice(0, 100);
    }

    return res.json(
      items.map((doc) => ({
        id: String(doc._id),
        customerId: doc.customerId,
        pickup: doc.pickup,
        dropoff: doc.dropoff,
        distanceKm: doc.distanceKm,
        estimatedFareLkr: doc.estimatedFareLkr,
        status: doc.status,
        driverId: doc.driverId ? String(doc.driverId) : "",
        driverName: doc.driverName || "",
        driverPhone: doc.driverPhone || "",
        vehicleNumber: doc.vehicleNumber || "",
        vehicleType: doc.vehicleType || "",
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        ...pickupPayloadFromDoc(doc),
      }))
    );
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function listPendingRideRequests(req, res) {
  try {
    if (isDbConnected()) {
      const items = await RideRequest.find({ status: "pending" }).sort({ createdAt: -1 }).limit(50);
      return res.json(
        items.map((doc) => ({
          id: String(doc._id),
          customerId: doc.customerId,
          pickup: doc.pickup,
          dropoff: doc.dropoff,
          distanceKm: doc.distanceKm,
          estimatedFareLkr: doc.estimatedFareLkr,
          status: doc.status,
          createdAt: doc.createdAt,
          driverBidLkr: Number(doc.driverBidLkr) || 0,
          driverBidDriverName: doc.driverBidDriverName || "",
          driverBidDriverId: doc.driverBidDriverId ? String(doc.driverBidDriverId) : "",
          passengerBidResponse: normPassengerBidResponse(doc),
        }))
      );
    }
    const items = memoryRideRequests
      .filter((r) => r.status === "pending")
      .slice(0, 50)
      .map((doc) => ({
        id: String(doc._id),
        customerId: doc.customerId,
        pickup: doc.pickup,
        dropoff: doc.dropoff,
        distanceKm: doc.distanceKm,
        estimatedFareLkr: doc.estimatedFareLkr,
        status: doc.status,
        createdAt: doc.createdAt,
        driverBidLkr: Number(doc.driverBidLkr) || 0,
        driverBidDriverName: doc.driverBidDriverName || "",
        driverBidDriverId: doc.driverBidDriverId ? String(doc.driverBidDriverId) : "",
        passengerBidResponse: normPassengerBidResponse(doc),
      }));
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function respondRideRequest(req, res) {
  try {
    const { requestId } = req.params;
    const { action, driverId: bodyDriverId } = req.body || {};
    if (!requestId) return res.status(400).json({ message: "requestId missing" });
    if (action !== "accepted" && action !== "declined") {
      return res.status(400).json({ message: "action must be accepted or declined" });
    }

    let resolvedDriverId = String(bodyDriverId ?? "").trim();
    if (!resolvedDriverId) {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (token) {
        try {
          const payload = verifyToken(token);
          if (payload && payload.role === "driver" && payload.sub) {
            resolvedDriverId = String(payload.sub);
          }
        } catch (_) {
          /* ignore */
        }
      }
    }

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });
    if (doc.status !== "pending") return res.status(409).json({ message: `Request already ${doc.status}` });

    let driver = null;
    if (resolvedDriverId && isDbConnected()) {
      driver = await Driver.findById(resolvedDriverId).catch(() => null);
    }

    doc.status = action;
    if (action === "accepted") {
      doc.driverId = String(driver ? driver._id : resolvedDriverId || "").trim();
      doc.driverName = driver?.fullName ?? doc.driverName;
      doc.driverPhone = driver?.phone ?? doc.driverPhone;
      doc.vehicleNumber = driver?.vehicleNumber ?? doc.vehicleNumber;
      doc.vehicleType = doc.vehicleType || "";
      doc.driverAtPickup = false;
      doc.driverAtPickupAt = null;
    }
    if (isDbConnected()) {
      await doc.save();
    }

    const io = req.app.get("io");
    const pickupSnap = pickupPayloadFromDoc(doc);

    if (io) {
      io.emit("rideRequestStatusUpdate", {
        requestId: String(doc._id),
        status: doc.status,
        driverAtPickup: pickupSnap.driverAtPickup,
        driverAtPickupAt: pickupSnap.driverAtPickupAt,
        driver: {
          id: doc.driverId,
          name: doc.driverName,
          phone: doc.driverPhone,
          vehicleNumber: doc.vehicleNumber,
          vehicleType: doc.vehicleType,
        },
      });
    }

    return res.json({
      message: "Ride request updated",
      request: {
        id: String(doc._id),
        status: doc.status,
        driverId: doc.driverId,
        driverName: doc.driverName,
        driverPhone: doc.driverPhone,
        vehicleNumber: doc.vehicleNumber,
        vehicleType: doc.vehicleType,
        ...pickupSnap,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

async function completeRideRequest(req, res) {
  try {
    const { requestId } = req.params;
    if (!requestId) return res.status(400).json({ message: "requestId missing" });

    let doc = null;
    if (isDbConnected()) {
      doc = await RideRequest.findById(requestId);
    } else {
      doc = memoryRideRequests.find((r) => String(r._id) === String(requestId)) || null;
    }
    if (!doc) return res.status(404).json({ message: "Ride request not found" });

    if (doc.status !== "accepted") {
      return res.status(409).json({ message: `Only accepted rides can be finished (current: ${doc.status})` });
    }

    doc.status = "completed";
    if (isDbConnected()) {
      await doc.save();
    }

    const driverIdStr = String(doc.driverId || "").trim();
    const requestIdStr = String(doc._id);
    if (driverIdStr) {
      const routeLabel = `${doc.pickup?.address || "Pickup"} → ${doc.dropoff?.address || "Drop"}`;
      const fareLkr = fareLkrForPayment(doc);
      try {
        if (isDbConnected()) {
          await DriverTripEarning.findOneAndUpdate(
            { driverId: driverIdStr, rideRequestId: requestIdStr },
            {
              $set: {
                driverId: driverIdStr,
                rideRequestId: requestIdStr,
                fareLkr,
                routeLabel: routeLabel.slice(0, 200),
                completedAt: new Date(),
              },
            },
            { upsert: true }
          );
        } else {
          recordTripEarningMemory({
            driverId: driverIdStr,
            rideRequestId: requestIdStr,
            fareLkr,
            routeLabel,
          });
        }
      } catch (_) {
        /* still complete trip if earning log fails */
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("rideRequestStatusUpdate", {
        requestId: String(doc._id),
        status: doc.status,
        driver: {
          id: doc.driverId,
          name: doc.driverName,
          phone: doc.driverPhone,
          vehicleNumber: doc.vehicleNumber,
          vehicleType: doc.vehicleType,
        },
      });
    }

    return res.json({
      message: "Ride completed",
      request: {
        id: String(doc._id),
        status: doc.status,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

module.exports = {
  createRideRequest,
  getRideRequestById,
  listMyRideRequests,
  listDriverRideRequests,
  listPendingRideRequests,
  submitDriverBid,
  setPassengerBidResponse,
  markDriverArrivedAtPickup,
  respondRideRequest,
  completeRideRequest,
};

