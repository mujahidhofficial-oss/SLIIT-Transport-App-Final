import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { Booking, Trip, cancelBooking, loadBookingsHistory, useBookingStore } from "@/app/_state/bookingStore";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

const API_BASE_URL = getApiBaseUrl();

type RideRequestHistoryItem = {
  id: string;
  /** Set when viewing as driver — passenger account id. */
  customerId?: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  distanceKm: number;
  estimatedFareLkr: number;
  status: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  createdAt: string;
};

type UnifiedRow =
  | {
      kind: "booking";
      key: string;
      sortMs: number;
      booking: Booking;
      trip: Trip;
      /** True when trip meta is not in the store (still show the booking). */
      tripMetaMissing: boolean;
    }
  | { kind: "ride"; key: string; sortMs: number; ride: RideRequestHistoryItem };

function parseRideHistoryJson(raw: unknown): RideRequestHistoryItem[] {
  if (Array.isArray(raw)) return raw as RideRequestHistoryItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.requests)) return o.requests as RideRequestHistoryItem[];
    if (Array.isArray(o.data)) return o.data as RideRequestHistoryItem[];
  }
  return [];
}

function rideRowSortMs(r: RideRequestHistoryItem): number {
  const raw = r.createdAt ?? (r as { updatedAt?: string }).updatedAt;
  const t = raw ? new Date(raw as string).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function stubTripForBookingHistory(booking: Booking, tripId: string): Trip {
  return {
    id: tripId,
    from: "Scheduled trip",
    to: "Route details will appear after you open Home, or if the trip was removed.",
    time: new Date(booking.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
    departureTimeISO: booking.createdAt,
    departureTimeMs: new Date(booking.createdAt).getTime() || 0,
    seatsTotal: Math.max(1, booking.seatNumbers.length || 1),
    seatsAvailable: 0,
    price: 0,
    driverId: "",
    distanceKm: 0,
  };
}

type StatusVisual = { textColor: string; bg: string; border: string };

function rideStatusVisual(st: string): StatusVisual {
  switch (st) {
    case "completed":
      return { textColor: BrandColors.primaryDark, bg: BrandColors.accentSoft, border: "rgba(8, 94, 155, 0.22)" };
    case "accepted":
      return { textColor: BrandColors.success, bg: "rgba(13, 177, 75, 0.12)", border: "rgba(13, 177, 75, 0.35)" };
    case "pending":
      return { textColor: BrandColors.textDark, bg: BrandColors.surfaceMuted, border: BrandColors.border };
    case "declined":
    case "cancelled":
      return { textColor: "#9B2C3C", bg: "rgba(215, 38, 61, 0.08)", border: "rgba(215, 38, 61, 0.35)" };
    default:
      return { textColor: BrandColors.textMuted, bg: BrandColors.surfaceMuted, border: BrandColors.border };
  }
}

function bookingStatusVisual(args: {
  raw: string;
  status: Booking["status"];
}): StatusVisual {
  const raw = args.raw.toLowerCase();
  if (raw === "paid" || args.status === "completed") {
    return { textColor: BrandColors.primaryDark, bg: BrandColors.accentSoft, border: "rgba(8, 94, 155, 0.22)" };
  }
  if (raw === "accepted" || args.status === "upcoming") {
    return { textColor: BrandColors.success, bg: "rgba(13, 177, 75, 0.12)", border: "rgba(13, 177, 75, 0.35)" };
  }
  if (raw === "pending") {
    return { textColor: BrandColors.textDark, bg: BrandColors.surfaceMuted, border: BrandColors.border };
  }
  if (raw === "declined" || args.status === "cancelled") {
    return { textColor: "#9B2C3C", bg: "rgba(215, 38, 61, 0.08)", border: "rgba(215, 38, 61, 0.35)" };
  }
  return { textColor: BrandColors.textMuted, bg: BrandColors.surfaceMuted, border: BrandColors.border };
}

function RouteEndpoints({ from, to }: { from: string; to: string }) {
  return (
    <View style={styles.routeEndpoints}>
      <View style={styles.routeTrack}>
        <View style={[styles.routeDot, styles.routeDotA]} />
        <View style={styles.routeLine} />
        <View style={[styles.routeDot, styles.routeDotB]} />
      </View>
      <View style={styles.routeTextCol}>
        <View>
          <Text style={styles.routeTag}>Pickup</Text>
          <Text style={styles.routeAddr} numberOfLines={2}>
            {from}
          </Text>
        </View>
        <View style={{ marginTop: Space.sm }}>
          <Text style={styles.routeTag}>Drop-off</Text>
          <Text style={styles.routeAddr} numberOfLines={2}>
            {to}
          </Text>
        </View>
      </View>
    </View>
  );
}

function StatusChip({ label, visual }: { label: string; visual: StatusVisual }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: visual.bg, borderColor: visual.border }]}>
      <Text style={[styles.statusChipText, { color: visual.textColor }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

async function openRouteInGoogleMaps(fromAddr: string, toAddr: string) {
  const p = fromAddr.trim();
  const d = toAddr.trim();
  let url: string;
  if (p && d) {
    url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(p)}&destination=${encodeURIComponent(d)}`;
  } else if (d) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d)}`;
  } else if (p) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p)}`;
  } else {
    url = "https://www.google.com/maps/search/?api=1&query=Colombo%2C+Sri+Lanka";
  }
  await Linking.openURL(url);
}

export default function TripHistory() {
  const insets = useSafeAreaInsets();
  const { bookings, trips } = useBookingStore();
  const [rideRequests, setRideRequests] = useState<RideRequestHistoryItem[]>([]);
  const [loadingRides, setLoadingRides] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isDriver, setIsDriver] = useState(false);

  const loadRideRequests = useCallback(async () => {
    const session = await getAuthSession();
    const id = session?.user?.id;
    const driver = session?.user?.role === "driver";
    setIsDriver(driver);
    if (!id) {
      setRideRequests([]);
      setLoadingRides(false);
      return;
    }
    setLoadingRides(true);
    const headers: Record<string, string> = { Accept: "application/json" };
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
    const url = driver
      ? `${API_BASE_URL}/api/ride-requests/driver/my?driverId=${encodeURIComponent(id)}`
      : `${API_BASE_URL}/api/ride-requests/my?customerId=${encodeURIComponent(id)}`;
    try {
      const res = await fetch(url, { headers });
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        setRideRequests([]);
        return;
      }
      const parsed = parseRideHistoryJson(raw).map((row, i) => {
        const id = String(row.id ?? (row as { _id?: string })._id ?? "").trim();
        return { ...row, id: id || `ride-${i}` };
      });
      setRideRequests(parsed);
    } finally {
      setLoadingRides(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const session = await getAuthSession();
      const driver = session?.user?.role === "driver";
      await Promise.all([
        driver ? Promise.resolve() : loadBookingsHistory().catch(() => {}),
        loadRideRequests(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadRideRequests]);

  useFocusEffect(
    useCallback(() => {
      void loadRideRequests();
      void (async () => {
        const session = await getAuthSession();
        if (session?.user?.role === "driver") return;
        try {
          await loadBookingsHistory();
        } catch {
          /* keep prior store; list still shows ride requests */
        }
      })();
    }, [loadRideRequests])
  );

  const unifiedList = useMemo(() => {
    const rows: UnifiedRow[] = [];

    if (!isDriver) {
      for (const b of bookings) {
        const trip = trips.find((t) => t.id === b.tripId);
        const sortT = new Date(b.createdAt).getTime();
        rows.push({
          kind: "booking",
          key: `b:${b.id}`,
          sortMs: Number.isFinite(sortT) ? sortT : 0,
          booking: b,
          trip: trip ?? stubTripForBookingHistory(b, b.tripId),
          tripMetaMissing: !trip,
        });
      }
    }

    for (const r of rideRequests) {
      rows.push({
        kind: "ride",
        key: `r:${r.id}`,
        sortMs: rideRowSortMs(r),
        ride: r,
      });
    }

    rows.sort((a, b) => b.sortMs - a.sortMs);
    return rows;
  }, [bookings, trips, rideRequests, isDriver]);

  const showInitialSpinner =
    loadingRides && unifiedList.length === 0 && (isDriver || bookings.length === 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top + Space.sm }]}>
      <View style={styles.headerOuter}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <ScreenHeader
              showBack
              title="Trip history"
              subtitle={
                isDriver
                  ? "On-demand rides you accepted or finished, newest first."
                  : "Every ride you request or book, with the latest on top."
              }
            />
          </View>
          <ProfileAvatar size={48} />
        </View>
      </View>

      {showInitialSpinner ? (
        <View style={styles.loadingBlock} accessibilityLabel="Loading trip history">
          <ActivityIndicator size="large" color={BrandColors.primary} />
          <Text style={styles.loadingCaption}>Loading your trips…</Text>
        </View>
      ) : null}

      <FlatList
        style={styles.listFlex}
        data={unifiedList}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BrandColors.primaryDark}
            colors={[BrandColors.primaryDark]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Math.max(insets.bottom, 20) + Space.lg,
            flexGrow: 1,
          },
        ]}
        renderItem={({ item }) =>
          item.kind === "booking" ? (
            <BookingHistoryCard
              booking={item.booking}
              trip={item.trip}
              tripMetaMissing={item.tripMetaMissing}
            />
          ) : (
            <RideRequestHistoryCard ride={item.ride} variant={isDriver ? "driver" : "passenger"} />
          )
        }
        ListEmptyComponent={
          !showInitialSpinner ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="time-outline" size={36} color={BrandColors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No trips yet</Text>
              <Text style={styles.empty}>
                {isDriver
                  ? "When you accept and complete on-demand rides from Trip action, they will be listed here."
                  : "When you request a driver or reserve seats on a trip, each trip appears here with status and fare."}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

function RideRequestHistoryCard({
  ride,
  variant,
}: {
  ride: RideRequestHistoryItem;
  variant: "passenger" | "driver";
}) {
  const st = (ride.status || "").toLowerCase();
  const fromLabel = ride.pickup?.address?.trim() || "Pickup";
  const toLabel = ride.dropoff?.address?.trim() || "Drop-off";
  const visual = rideStatusVisual(st);
  const driverId = String(ride.driverId ?? "").trim();
  const canLeaveFeedback = variant === "passenger" && st === "completed" && !!driverId;

  const statusLabel =
    variant === "driver"
      ? st === "completed"
        ? "Completed"
        : st === "accepted"
        ? "In progress"
        : st === "pending"
        ? "Pending"
        : st === "declined"
        ? "Declined"
        : st === "cancelled"
        ? "Cancelled"
        : ride.status
      : st === "completed"
      ? "Completed"
      : st === "accepted"
      ? "Driver accepted"
      : st === "pending"
      ? "Waiting for driver"
      : st === "declined"
      ? "Declined"
      : st === "cancelled"
      ? "Cancelled"
      : ride.status;

  const statusSubtitle =
    variant === "driver"
      ? st === "completed"
        ? "You marked this ride as finished. Fare counts toward earnings when logged."
        : st === "accepted"
        ? "You accepted this request — navigate with Maps, then finish in Trip action when done."
        : st === "pending"
        ? "This request was not assigned to you yet."
        : st === "declined"
        ? "This request was declined or reassigned."
        : st === "cancelled"
        ? "This ride was cancelled."
        : "Status updated."
      : st === "completed"
      ? "This on-demand ride is finished."
      : st === "accepted"
      ? "Driver accepted — they are on the way."
      : st === "pending"
      ? "Drivers nearby can accept your request."
      : st === "declined"
      ? "No driver took this request."
      : st === "cancelled"
      ? "This request was cancelled."
      : "Status updated.";

  const when = ride.createdAt
    ? new Date(ride.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    : "";

  const passengerRef = ride.customerId
    ? `${ride.customerId.length > 12 ? `${ride.customerId.slice(0, 10)}…` : ride.customerId}`
    : "";

  return (
    <AppCard style={[styles.card, styles.cardRide]} padded>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.typeBadge, styles.typeBadgeRide]}>
          <Ionicons
            name={variant === "driver" ? "car-outline" : "flash-outline"}
            size={14}
            color={BrandColors.primaryDark}
          />
          <Text style={styles.typeBadgeText}>{variant === "driver" ? "Your ride" : "On-demand"}</Text>
        </View>
        <StatusChip label={statusLabel} visual={visual} />
      </View>

      <RouteEndpoints from={fromLabel} to={toLabel} />

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={BrandColors.textLight} />
        <Text style={styles.metaText}>
          {when}
          {Number(ride.distanceKm) > 0 ? ` · ${Number(ride.distanceKm).toFixed(1)} km` : ""}
        </Text>
      </View>

      {variant === "passenger" && (ride.driverName || ride.driverPhone) ? (
        <View style={styles.driverBox}>
          {ride.driverName ? (
            <Text style={styles.driverLine}>
              <Text style={styles.driverBold}>Driver </Text>
              {ride.driverName}
              {ride.vehicleType ? ` · ${ride.vehicleType}` : ""}
              {ride.vehicleNumber ? ` · ${ride.vehicleNumber}` : ""}
            </Text>
          ) : null}
          {ride.driverPhone ? <Text style={styles.driverContact}>{ride.driverPhone}</Text> : null}
        </View>
      ) : null}

      {variant === "driver" && passengerRef ? (
        <View style={styles.driverBox}>
          <Text style={styles.driverLine}>
            <Text style={styles.driverBold}>Passenger ref </Text>
            {passengerRef}
          </Text>
        </View>
      ) : null}

      <Text style={styles.statusHint}>{statusSubtitle}</Text>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.priceLabel}>Est. fare</Text>
          <Text style={styles.price}>LKR {Math.round(Number(ride.estimatedFareLkr) || 0)}</Text>
        </View>
        <View style={styles.footerActions}>
          <Pressable
            onPress={() => void openRouteInGoogleMaps(fromLabel, toLabel)}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open route in maps"
          >
            <Ionicons name="map-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.primaryBtnText}>Maps</Text>
          </Pressable>
          {canLeaveFeedback ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/driver-feedback",
                  params: {
                    rideRequestId: ride.id,
                    driverId,
                    driverName: ride.driverName ?? "",
                  },
                })
              }
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Leave feedback for driver"
            >
              <Ionicons name="star-outline" size={18} color={BrandColors.primaryDark} />
              <Text style={styles.primaryBtnText}>Feedback</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </AppCard>
  );
}

function BookingHistoryCard({
  booking,
  trip,
  tripMetaMissing,
}: {
  booking: Booking;
  trip: Trip;
  tripMetaMissing: boolean;
}) {
  const raw = (booking.rawStatus ?? "").toLowerCase();
  const isPending = raw === "pending";
  const isAccepted = raw === "accepted";
  const isPaid = raw === "paid";
  const isDeclined = raw === "declined";
  const visual = bookingStatusVisual({ raw, status: booking.status });

  const statusLabel = isPaid
    ? "Completed & paid"
    : isAccepted
    ? "Driver accepted"
    : isPending
    ? "Waiting for driver"
    : isDeclined || booking.status === "cancelled"
    ? "Declined / cancelled"
    : booking.status === "completed"
    ? "Completed"
    : "Upcoming";

  const statusSubtitle = isPaid
    ? "Trip finished and payment recorded."
    : isAccepted
    ? "Driver accepted your booking — get ready, they are on the way."
    : isPending
    ? "Your booking request is with the driver. You will see updates here."
    : isDeclined
    ? "Driver declined this booking."
    : booking.status === "cancelled"
    ? "You or the driver cancelled this booking."
    : booking.status === "upcoming"
    ? "Upcoming trip — seats reserved."
    : "Trip status updated.";

  return (
    <AppCard style={[styles.card, styles.cardBooking]} padded>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.typeBadge, styles.typeBadgeBooking]}>
          <Ionicons name="bus-outline" size={14} color={BrandColors.sky} />
          <Text style={[styles.typeBadgeText, { color: BrandColors.sky }]}>Scheduled</Text>
        </View>
        <StatusChip label={statusLabel} visual={visual} />
      </View>

      <RouteEndpoints from={trip.from} to={trip.to} />

      {tripMetaMissing ? (
        <View style={styles.stubNote}>
          <Ionicons name="refresh-outline" size={14} color={BrandColors.primary} />
          <Text style={styles.stubNoteText}>
            Full route and fare load from Home. Seats below are saved for this booking.
          </Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <Ionicons name="people-outline" size={14} color={BrandColors.textLight} />
        <Text style={styles.metaText}>
          Departs {trip.time} · Seats {booking.seatNumbers.join(", ")}
        </Text>
      </View>

      {(trip.driverName || trip.driverPhone) && (
        <View style={styles.driverBox}>
          {trip.driverName ? (
            <Text style={styles.driverLine}>
              <Text style={styles.driverBold}>Driver </Text>
              {trip.driverName}
              {trip.vehicleType ? ` · ${trip.vehicleType}` : ""}
              {trip.vehicleNumber ? ` · ${trip.vehicleNumber}` : ""}
            </Text>
          ) : null}
          {trip.driverPhone ? <Text style={styles.driverContact}>{trip.driverPhone}</Text> : null}
        </View>
      )}

      <Text style={styles.statusHint}>{statusSubtitle}</Text>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.priceLabel}>Per seat</Text>
          <Text style={styles.price}>{tripMetaMissing || trip.price <= 0 ? "—" : `LKR ${trip.price.toFixed(0)}`}</Text>
        </View>
        <View style={styles.footerActions}>
          <Pressable
            onPress={() => void openRouteInGoogleMaps(trip.from, trip.to)}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open route in maps"
          >
            <Ionicons name="map-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.primaryBtnText}>Maps</Text>
          </Pressable>
          {booking.status === "upcoming" ? (
            <Pressable
              onPress={() => void cancelBooking(booking.id)}
              style={({ pressed }) => [styles.cancelPill, pressed && styles.cancelPillPressed]}
              accessibilityRole="button"
              accessibilityLabel="Cancel booking"
            >
              <Text style={styles.cancelPillText}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBg.light },
  headerOuter: {
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: Layout.screenPaddingX - 2,
  },
  headerRow: {
    paddingBottom: Space.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  listFlex: { flex: 1 },
  listContent: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.xs,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  loadingBlock: {
    paddingVertical: Space.xl,
    alignItems: "center",
    gap: Space.sm,
  },
  loadingCaption: { ...Typography.subhead, color: BrandColors.textMuted },
  card: {
    marginTop: Space.md,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: "rgba(193, 205, 216, 0.45)",
  },
  cardRide: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.primary,
  },
  cardBooking: {
    borderLeftWidth: 4,
    borderLeftColor: BrandColors.sky,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Space.sm,
    marginBottom: Space.md,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    maxWidth: "56%",
  },
  typeBadgeRide: {
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.2)",
  },
  typeBadgeBooking: {
    backgroundColor: "rgba(79, 148, 184, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(79, 148, 184, 0.35)",
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    letterSpacing: 0.2,
  },
  statusChip: {
    maxWidth: "48%",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  routeEndpoints: { flexDirection: "row", gap: Space.sm },
  routeTrack: { width: 14, alignItems: "center", paddingTop: 4 },
  routeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  routeDotA: { borderColor: BrandColors.primary, backgroundColor: BrandColors.surface },
  routeDotB: { borderColor: BrandColors.sky, backgroundColor: BrandColors.surface },
  routeLine: {
    width: 2,
    height: 32,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: "rgba(138, 150, 163, 0.35)",
  },
  routeTextCol: { flex: 1, minWidth: 0 },
  routeTag: { ...Typography.overline, color: BrandColors.textLight, marginBottom: 2 },
  routeAddr: { fontSize: 15, fontWeight: "700", color: BrandColors.textDark, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Space.md,
  },
  metaText: { ...Typography.caption, color: BrandColors.textLight, flex: 1 },
  stubNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    marginTop: Space.sm,
    padding: Space.sm,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  stubNoteText: { flex: 1, ...Typography.caption, color: BrandColors.textDark, lineHeight: 18 },
  driverBox: {
    marginTop: Space.sm,
    padding: Space.sm,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.md,
  },
  driverLine: { fontSize: 13, color: BrandColors.textDark, lineHeight: 19 },
  driverBold: { fontWeight: "800" },
  driverContact: { marginTop: 4, fontSize: 13, fontWeight: "600", color: BrandColors.primaryDark },
  statusHint: {
    marginTop: Space.sm,
    fontSize: 12,
    color: BrandColors.textMuted,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.border,
    gap: Space.sm,
  },
  priceLabel: { ...Typography.overline, color: BrandColors.textLight, marginBottom: 2 },
  price: { fontSize: 20, fontWeight: "900", color: BrandColors.primaryDark, letterSpacing: -0.3 },
  footerActions: { flexDirection: "row", alignItems: "center", gap: Space.sm, flexShrink: 0 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BrandColors.accentSoft,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.2)",
  },
  primaryBtnPressed: { opacity: 0.88 },
  primaryBtnText: { fontSize: 14, fontWeight: "800", color: BrandColors.primaryDark },
  cancelPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: "rgba(215, 38, 61, 0.45)",
    backgroundColor: BrandColors.surface,
  },
  cancelPillPressed: { opacity: 0.85 },
  cancelPillText: { fontSize: 14, fontWeight: "800", color: "#D7263D" },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Space.lg,
    paddingTop: Space.xxl,
    paddingBottom: Space.xxl,
    alignItems: "center",
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: BrandColors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  emptyTitle: {
    textAlign: "center",
    ...Typography.headline,
    color: BrandColors.primaryDark,
    marginBottom: Space.sm,
  },
  empty: {
    textAlign: "center",
    ...Typography.subhead,
    color: BrandColors.textMuted,
    lineHeight: 20,
    maxWidth: 300,
  },
});
