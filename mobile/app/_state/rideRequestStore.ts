import { useSyncExternalStore } from "react";
import { io } from "socket.io-client";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";

export type RideRequestStatus = "pending" | "accepted" | "declined" | "cancelled" | "completed";
export type PassengerBidResponse = "none" | "accepted" | "declined";

export type RideRequest = {
  id: string;
  customerId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  distanceKm: number;
  estimatedFareLkr: number;
  status: RideRequestStatus;
  driver?: {
    id: string;
    name?: string;
    phone?: string;
    vehicleNumber?: string;
    vehicleType?: string;
    showLocation?: boolean;
  };
  createdAt?: string;
  /** Driver’s offered fare (LKR) while request is pending — shown to passenger. */
  driverBidLkr?: number;
  driverBidDriverName?: string;
  driverBidDriverId?: string;
  passengerBidResponse?: PassengerBidResponse;
  /** Assigned driver marked arrival at pickup (after accept). */
  driverAtPickup?: boolean;
  driverAtPickupAt?: string;
};

type State = {
  activeRequest: RideRequest | null;
};

const API_BASE_URL = getApiBaseUrl();
let state: State = { activeRequest: null };
const listeners = new Set<() => void>();
let socketStarted = false;

function emit() {
  listeners.forEach((l) => l());
}

function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

function startSocketOnce() {
  if (socketStarted) return;
  socketStarted = true;
  try {
    const socket = io(API_BASE_URL, { transports: ["websocket"], forceNew: true });

    socket.on("rideRequestStatusUpdate", (payload: any) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId || state.activeRequest?.id !== requestId) return;
      const status = String(payload?.status ?? "") as RideRequestStatus;
      const driver = payload?.driver ?? {};
      const dap = payload?.driverAtPickup;
      const dapAt = payload?.driverAtPickupAt != null ? String(payload.driverAtPickupAt) : undefined;
      setState({
        activeRequest: {
          ...state.activeRequest!,
          status,
          ...(typeof dap === "boolean"
            ? { driverAtPickup: dap, driverAtPickupAt: dapAt ?? state.activeRequest!.driverAtPickupAt }
            : {}),
          driver: driver
            ? {
                id: String(driver.id ?? ""),
                name: driver.name ? String(driver.name) : undefined,
                phone: driver.phone ? String(driver.phone) : undefined,
                vehicleNumber: driver.vehicleNumber ? String(driver.vehicleNumber) : undefined,
                vehicleType: driver.vehicleType ? String(driver.vehicleType) : undefined,
                showLocation: typeof driver.showLocation === "boolean" ? !!driver.showLocation : undefined,
              }
            : state.activeRequest!.driver,
        },
      });
    });

    socket.on("rideRequestPickupUpdate", (payload: any) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId || state.activeRequest?.id !== requestId) return;
      const dap = !!payload?.driverAtPickup;
      const dapAt = payload?.driverAtPickupAt != null ? String(payload.driverAtPickupAt) : "";
      setState({
        activeRequest: {
          ...state.activeRequest!,
          driverAtPickup: dap,
          driverAtPickupAt: dapAt,
        },
      });
    });

    socket.on("rideRequestBidUpdate", (payload: any) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId || state.activeRequest?.id !== requestId) return;
      const amt = Math.round(Number(payload?.driverBidLkr));
      const pbr = String(payload?.passengerBidResponse ?? "").toLowerCase();
      const passengerBidResponse: PassengerBidResponse =
        pbr === "accepted" || pbr === "declined" ? pbr : "none";
      setState({
        activeRequest: {
          ...state.activeRequest!,
          driverBidLkr: Number.isFinite(amt) && amt > 0 ? amt : state.activeRequest!.driverBidLkr,
          driverBidDriverName: payload?.driverBidDriverName
            ? String(payload.driverBidDriverName)
            : state.activeRequest!.driverBidDriverName,
          driverBidDriverId: payload?.driverBidDriverId
            ? String(payload.driverBidDriverId)
            : state.activeRequest!.driverBidDriverId,
          passengerBidResponse:
            payload?.passengerBidResponse != null && String(payload.passengerBidResponse).length > 0
              ? passengerBidResponse
              : state.activeRequest!.passengerBidResponse,
        },
      });
    });

    socket.on("rideRequestBidPassengerResponse", (payload: any) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId || state.activeRequest?.id !== requestId) return;
      const pbr = String(payload?.passengerBidResponse ?? "").toLowerCase();
      const passengerBidResponse: PassengerBidResponse =
        pbr === "accepted" || pbr === "declined" ? pbr : "none";
      setState({
        activeRequest: {
          ...state.activeRequest!,
          passengerBidResponse,
        },
      });
    });
  } catch {
    // ignore
  }
}

async function jsonHeadersWithAuth(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const session = await getAuthSession();
  if (session?.token) h.Authorization = `Bearer ${session.token}`;
  return h;
}

export function useRideRequestStore() {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
  return snapshot;
}

export function clearActiveRideRequest() {
  setState({ activeRequest: null });
}

/** Merge fields into the active request (e.g. after polling driver bid). */
export function mergeActiveRideRequest(partial: Partial<RideRequest>) {
  if (!state.activeRequest) return;
  setState({ activeRequest: { ...state.activeRequest, ...partial } });
}

/** Read current ride from outside React (avoids stale closure in handlers). */
export function getActiveRideRequest(): RideRequest | null {
  return state.activeRequest;
}

export async function createRideRequest(input: {
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
}) {
  startSocketOnce();
  const session = await getAuthSession();
  const customerId = session?.user?.id;
  if (!customerId) throw new Error("Sign in to request a driver");

  const res = await fetch(`${API_BASE_URL}/api/ride-requests`, {
    method: "POST",
    headers: await jsonHeadersWithAuth(),
    body: JSON.stringify({ customerId, pickup: input.pickup, dropoff: input.dropoff }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);

  const r = body?.request ?? {};
  const req: RideRequest = {
    id: String(r.id),
    customerId: String(r.customerId ?? customerId),
    pickup: {
      address: String(r.pickup?.address ?? input.pickup.address ?? ""),
      lat: Number(r.pickup?.lat ?? input.pickup.lat),
      lng: Number(r.pickup?.lng ?? input.pickup.lng),
    },
    dropoff: {
      address: String(r.dropoff?.address ?? input.dropoff.address ?? ""),
      lat: Number(r.dropoff?.lat ?? input.dropoff.lat),
      lng: Number(r.dropoff?.lng ?? input.dropoff.lng),
    },
    distanceKm: Number(r.distanceKm ?? 0),
    estimatedFareLkr: Number(r.estimatedFareLkr ?? 0),
    status: String(r.status ?? "pending") as RideRequestStatus,
    driver: r.driverId
      ? {
          id: String(r.driverId),
          name: r.driverName ? String(r.driverName) : undefined,
          phone: r.driverPhone ? String(r.driverPhone) : undefined,
          vehicleNumber: r.vehicleNumber ? String(r.vehicleNumber) : undefined,
          vehicleType: r.vehicleType ? String(r.vehicleType) : undefined,
          showLocation: typeof r.driverShowLocation === "boolean" ? !!r.driverShowLocation : undefined,
        }
      : undefined,
    createdAt: r.createdAt ? String(r.createdAt) : undefined,
    driverBidLkr: Number(r.driverBidLkr) > 0 ? Math.round(Number(r.driverBidLkr)) : undefined,
    driverBidDriverName: r.driverBidDriverName ? String(r.driverBidDriverName) : undefined,
    driverBidDriverId: r.driverBidDriverId ? String(r.driverBidDriverId) : undefined,
    passengerBidResponse: normalizePassengerBidResponse(r.passengerBidResponse) ?? "none",
    driverAtPickup: !!r.driverAtPickup,
    driverAtPickupAt: r.driverAtPickupAt ? String(r.driverAtPickupAt) : undefined,
  };
  setState({ activeRequest: req });
  return req;
}

function normalizePassengerBidResponse(v: unknown): PassengerBidResponse | undefined {
  const s = String(v ?? "").toLowerCase();
  if (s === "accepted" || s === "declined" || s === "none") return s;
  return undefined;
}

export async function sendPassengerBidResponse(requestId: string, response: "accepted" | "declined") {
  startSocketOnce();
  const res = await fetch(`${API_BASE_URL}/api/ride-requests/${encodeURIComponent(requestId)}/bid-response`, {
    method: "PUT",
    headers: await jsonHeadersWithAuth(),
    body: JSON.stringify({ response }),
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(body?.message || `Request failed (${res.status})`);
  const pbr = String(body?.request?.passengerBidResponse ?? response).toLowerCase();
  const passengerBidResponse: PassengerBidResponse = pbr === "accepted" || pbr === "declined" ? pbr : "none";
  const cur = getActiveRideRequest();
  if (cur?.id === requestId) {
    setState({ activeRequest: { ...cur, passengerBidResponse } });
  }
  return body;
}

