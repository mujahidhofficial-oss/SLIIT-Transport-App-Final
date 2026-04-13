const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const DriverTripEarning = require("../models/DriverTripEarning");
const { getAllMemoryPayments } = require("./paymentDemoController");
const { listTripEarningsMemory } = require("../utils/driverTripEarningMemory");

function isDbConnected() {
  return mongoose.connection.readyState === 1;
}

function colomboDayKey(d) {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = WEEKDAYS[dt.getUTCDay()];
  return `${wd}, ${d} ${MONTHS[m - 1]}`;
}

/**
 * Driver earnings: trips finished (fare estimate) + passenger payments.
 * Same ride is not double-counted when payment includes rideRequestId.
 * GET /api/drivers/:driverId/earnings
 */
async function getDriverPaymentEarnings(req, res) {
  try {
    const idNorm = String(req.params.driverId || "").trim();
    if (!idNorm) return res.status(400).json({ message: "driverId is required" });

    let allCompleted;
    if (!isDbConnected()) {
      allCompleted = getAllMemoryPayments().filter((p) => p.status === "completed");
    } else {
      allCompleted = await Payment.find({ status: "completed" }).lean();
    }
    const payments = allCompleted.filter((p) => String(p.driverId || "").trim() === idNorm);

    let tripRows;
    if (!isDbConnected()) {
      tripRows = listTripEarningsMemory(idNorm);
    } else {
      tripRows = await DriverTripEarning.find({ driverId: idNorm }).lean();
    }

    const paidRideIds = new Set(
      payments.map((p) => (p.rideRequestId ? String(p.rideRequestId).trim() : "")).filter(Boolean)
    );

    const byDay = new Map();
    function addItem(day, fare, item) {
      const f = Math.round(Number(fare) || 0);
      if (f <= 0) return;
      const prev = byDay.get(day) || { totalLkr: 0, tripCount: 0, items: [] };
      prev.totalLkr += f;
      prev.tripCount += 1;
      prev.items.push(item);
      byDay.set(day, prev);
    }
//get driver earnings
    for (const t of tripRows) {
      const rid = String(t.rideRequestId || "").trim();
      if (rid && paidRideIds.has(rid)) continue;
      const at = t.completedAt || t.createdAt;
      if (!at) continue;
      const day = colomboDayKey(at);
      const fare = Number(t.fareLkr ?? 0);
      addItem(day, fare, {
        kind: "trip_finished",
        tripDescription: (t.routeLabel || "On-demand trip").slice(0, 80),
        fareLkr: Math.round(fare),
        method: "—",
        rideRequestId: rid,
      });
    }

    for (const p of payments) {
      const at = p.updatedAt || p.createdAt;
      if (!at) continue;
      const day = colomboDayKey(at);
      const fare = Number(p.amount ?? 0);
      addItem(day, fare, {
        kind: "payment",
        referenceCode: p.referenceCode || "",
        tripDescription: (p.tripDescription || "").slice(0, 80),
        fareLkr: Math.round(fare),
        method: p.paymentMethod || "card",
        rideRequestId: p.rideRequestId ? String(p.rideRequestId).trim() : "",
      });
    }

    const daily = Array.from(byDay.entries())
      .map(([date, v]) => ({
        date,
        dateLabel: formatDayLabel(date),
        totalLkr: Math.round(v.totalLkr),
        tripCount: v.tripCount,
        trips: v.items.slice(-8),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const todayKey = colomboDayKey(new Date());
    const totalLkr = daily.reduce((s, d) => s + d.totalLkr, 0);
    const todayRow = daily.find((d) => d.date === todayKey);
    const todayLkr = todayRow ? todayRow.totalLkr : 0;

    res.json({
      driverId: idNorm,
      todayLkr,
      totalLkr,
      todayKey,
      daily,
      note: "Includes finished on-demand trips (estimated fare) and completed passenger payments. Same ride is counted once when payment is linked.",
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
}

module.exports = { getDriverPaymentEarnings };
