import { useSyncExternalStore } from "react";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { io } from "socket.io-client";

export type Trip = {
  id: string;
  from: string;
  to: string;
  time: string;
  departureTimeISO: string;
  departureTimeMs: number;
  seatsTotal: number;
  seatsAvailable: number;
  price: number;
  /** Driver id from API — used for “nearby driver” labels. */
  driverId: string;
  /** Optional friendly driver name to show in UI. */
  driverName?: string;
  /** Optional vehicle number (plate). */
  vehicleNumber?: string;
  /** Optional vehicle type (car / van / bike). */
  vehicleType?: string;
  /** Optional phone/contact for driver, when API provides it. */
  driverPhone?: string;
  /** Route distance when available (km); used for sorting “nearby” rides. */
  distanceKm: number;
};
// Note: the main booking logic and API integration is in `letgo-driver-module/controllers/bookingController.js` (called by `createBookingRequest`), which also has server-side validation.
export type BookingStatus = "upcoming" | "completed" | "cancelled";
// Note: the main booking logic and API integration is in `letgo-driver-module/controllers/bookingController.js` (called by `createBookingRequest`), which also has server-side validation.
export type Booking = {
  id: string;
  tripId: string;
  seatNumbers: number[];
  status: BookingStatus;
  /** Raw backend status (pending / accepted / paid / declined / cancelled). */
  rawStatus?: string;
  createdAt: string;
};

type State = {
  trips: Trip[];
  bookings: Booking[];
  loadingTrips: boolean;
  tripsError: string | null;
};

const API_BASE_URL = getApiBaseUrl();

async function jsonHeadersWithAuth(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const session = await getAuthSession();
  if (session?.token) h.Authorization = `Bearer ${session.token}`;
  return h;
}

async function requireCustomerId(): Promise<string> {
  const session = await getAuthSession();
  const id = session?.user?.id;
  if (!id) {
    throw new Error("Sign in to book a ride");
  }
  return id;
}

/** Client checks before POST /api/bookings (server: `bookingController.createBookingRequest`). */
export function validateSeatSelectionForTrip(trip: Trip, seatNumbers: number[]): string[] {
  const errs: string[] = [];
  const total = Math.max(1, trip.seatsTotal);
  const taken = Math.min(total, Math.max(0, trip.seatsTotal - trip.seatsAvailable));

  if (!seatNumbers.length) return ["Select at least one seat"];

  if (seatNumbers.length > trip.seatsAvailable) {
    errs.push(`You can only book up to ${trip.seatsAvailable} seat(s) on this trip`);
  }

  const uniq = new Set(seatNumbers);
  if (uniq.size !== seatNumbers.length) {
    errs.push("Each seat can only be selected once");
  }

  for (const n of seatNumbers) {
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > total) {
      errs.push(`Seat ${n} is not valid (choose 1–${total})`);
    } else if (n <= taken) {
      errs.push(`Seat ${n} is already reserved`);
    }
  }

  return errs;
}

let state: State = {
  trips: [],
  bookings: [],
  loadingTrips: false,
  tripsError: null,
};

const listeners = new Set<() => void>();
let socketStarted = false;

function mapBackendBookingStatus(bStatus: string): BookingStatus {
  // pending/accepted => upcoming, paid => completed, cancelled/declined => cancelled
  if (bStatus === "paid") return "completed";
  if (bStatus === "pending" || bStatus === "accepted") return "upcoming";
  return "cancelled";
}

function startSocketOnce() {
  if (socketStarted) return;
  socketStarted = true;

  try {
    const socket = io(API_BASE_URL, {
      transports: ["websocket"],
      forceNew: true,
    });

    socket.on("tripSeatsUpdate", (payload: any) => {
      const { tripId, availableSeats, seatsTotal, pricePerSeat } = payload ?? {};
      if (!tripId) return;
      setState({
        trips: state.trips.map((t) =>
          t.id === String(tripId)
            ? {
                ...t,
                seatsAvailable: Number(availableSeats),
                seatsTotal: Number(seatsTotal ?? t.seatsTotal),
                price: Number(pricePerSeat ?? t.price),
              }
            : t
        ),
      });
    });

    socket.on("bookingStatusUpdate", (payload: any) => {
      const { bookingId, status } = payload ?? {};
      if (!bookingId) return;
      setState({
        bookings: state.bookings.map((b) =>
          b.id === String(bookingId)
            ? { ...b, status: mapBackendBookingStatus(String(status)), rawStatus: String(status) }
            : b
        ),
      });
    });
  } catch {
    // Ignore socket errors for now.
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

export function useBookingStore() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
  return snapshot;
}

/** Load trips from API if the given tripId is not already in the store (e.g. deep link to seat-selection). */
export async function ensureTripLoaded(tripId: string | undefined) {
  if (!tripId) return;
  if (state.trips.some((t) => t.id === tripId)) return;
  await loadTrips();
}

export async function loadTrips() {
  startSocketOnce();
  setState({ loadingTrips: true, tripsError: null });
  try {
    const res = await fetch(`${API_BASE_URL}/api/trips`);
    if (!res.ok) {
      throw new Error(`Failed to load trips (${res.status})`);
    }

    const apiTrips = (await res.json()) as {
      _id: string;
      pickupLocation: string;
      destination: string;
      departureTime: string;
      seatLimit: number;
      availableSeats: number;
      pricePerSeat: number;
      driverId?: string;
      driverName?: string;
      driverPhone?: string;
      vehicleNumber?: string;
      vehicleType?: string;
      distanceKm?: number;
    }[];

    const mappedTrips: Trip[] = apiTrips.map((t) => ({
      id: t._id,
      from: t.pickupLocation,
      to: t.destination,
      departureTimeISO: t.departureTime,
      departureTimeMs: new Date(t.departureTime).getTime(),
      time: new Date(t.departureTime).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      seatsTotal: t.seatLimit,
      seatsAvailable: t.availableSeats,
      price: t.pricePerSeat,
      driverId: t.driverId ? String(t.driverId) : "driver",
      driverName: t.driverName,
      vehicleNumber: t.vehicleNumber,
      vehicleType: t.vehicleType,
      driverPhone: t.driverPhone,
      distanceKm: Number.isFinite(Number(t.distanceKm)) ? Number(t.distanceKm) : 0,
    }));

    setState({ trips: mappedTrips, loadingTrips: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setState({ loadingTrips: false, tripsError: message });
  }
}

export async function createBooking(tripId: string, seatNumbers: number[]): Promise<Booking> {
  startSocketOnce();
  const customerId = await requireCustomerId();

  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) {
    throw new Error("Trip not found — go back and refresh trips");
  }

  const fieldErrs = validateSeatSelectionForTrip(trip, seatNumbers);
  if (fieldErrs.length) {
    throw new Error(fieldErrs.join("\n"));
  }

  const seatsRequested = seatNumbers.length;
  const payload = {
    tripId,
    customerId,
    seatsRequested,
    seatNumbers,
  };

  const res = await fetch(`${API_BASE_URL}/api/bookings`, {
    method: "POST",
    headers: await jsonHeadersWithAuth(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(errorBody.message ?? `Booking failed (${res.status})`);
  }

  const body = (await res.json()) as { booking: { _id: string } };

  const booking: Booking = {
    id: body.booking._id,
    tripId,
    seatNumbers,
    rawStatus: "pending",
    status: "upcoming",
    createdAt: new Date().toISOString(),
  };

  // Reflect reserved seats immediately in UI.
  const updatedTrips = state.trips.map((t) =>
    t.id === tripId
      ? { ...t, seatsAvailable: Math.max(0, t.seatsAvailable - seatsRequested) }
      : t
  );

  setState({ trips: updatedTrips, bookings: [...state.bookings, booking] });
  return booking;
}

export async function cancelBooking(bookingId: string) {
  startSocketOnce();
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking || booking.status !== "upcoming") return;

  let customerId: string;
  try {
    customerId = await requireCustomerId();
  } catch {
    return;
  }

  const seatCount = booking.seatNumbers.length;
  try {
    const cancelRes = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/cancel`, {
      method: "PUT",
      headers: await jsonHeadersWithAuth(),
      body: JSON.stringify({ customerId }),
    });
    const cancelBody = await cancelRes.json().catch(() => ({}));
    if (!cancelRes.ok) throw new Error(cancelBody?.message ?? "Cancel failed");
  } finally {
    // Optimistically update UI even if socket updates are delayed.
    const updatedTrips = state.trips.map((t) =>
      t.id === booking.tripId ? { ...t, seatsAvailable: Math.min(t.seatsTotal, t.seatsAvailable + seatCount) } : t
    );
    const updatedBookings = state.bookings.map<Booking>((b) =>
      b.id === bookingId ? { ...b, status: "cancelled" } : b
    );
    setState({ trips: updatedTrips, bookings: updatedBookings });
  }
}

export async function loadBookingsHistory(customerId?: string) {
  startSocketOnce();
  let id = customerId;
  if (!id) {
    const session = await getAuthSession();
    id = session?.user?.id;
  }
  if (!id) {
    setState({ bookings: [] });
    return;
  }

  const url = `${API_BASE_URL}/api/bookings/history?customerId=${encodeURIComponent(id)}`;
  const session = await getAuthSession();
  const headers: Record<string, string> = {};
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Failed to load booking history (${res.status})`);
  const items = (await res.json().catch(() => [])) as { booking: any; trip: any }[];

  // Update trips first so seat selection/history can render price/time.
  const tripById = new Map<string, Trip>();
  for (const item of items) {
    if (item.trip?.id && !tripById.has(item.trip.id)) {
      tripById.set(item.trip.id, {
        id: item.trip.id,
        from: item.trip.from,
        to: item.trip.to,
        time: new Date(item.trip.departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        departureTimeISO: item.trip.departureTime,
        departureTimeMs: new Date(item.trip.departureTime).getTime(),
        seatsTotal: item.trip.seatsTotal,
        seatsAvailable: item.trip.seatsAvailable,
        price: item.trip.pricePerSeat,
        driverId: item.trip.driverId ? String(item.trip.driverId) : "driver",
        distanceKm: Number.isFinite(Number(item.trip.distanceKm)) ? Number(item.trip.distanceKm) : 0,
      });
    }
  }

  const mappedBookings: Booking[] = items.map((it) => ({
    id: String(it.booking._id),
    tripId: String(it.booking.tripId),
    seatNumbers: Array.isArray(it.booking.seatNumbers) ? it.booking.seatNumbers.map((n: any) => Number(n)) : [],
    rawStatus: String(it.booking.status),
    status: mapBackendBookingStatus(String(it.booking.status)),
    createdAt: it.booking.createdAt ? new Date(it.booking.createdAt).toISOString() : new Date().toISOString(),
  }));

  setState({
    trips: [...tripById.values(), ...state.trips.filter((t) => !tripById.has(t.id))],
    bookings: mappedBookings,
  });
}

export function completeBooking(bookingId: string) {
  const updated = state.bookings.map<Booking>((b) =>
    b.id === bookingId ? { ...b, status: "completed" as const } : b
  );
  setState({ bookings: updated });
}

