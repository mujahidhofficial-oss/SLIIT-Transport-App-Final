import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  FlatList,
  Keyboard,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space } from "@/app/_theme/tokens";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { getAuthSession } from "@/app/_state/authSession";
import type { Booking as BookingRecord } from "@/app/_state/bookingStore";
import { Trip, loadBookingsHistory, loadTrips, useBookingStore } from "@/app/_state/bookingStore";
// Note: this file focuses on the client-side booking flow and UI. The main booking logic and API integration is in `letgo-driver-module/controllers/bookingController.js` (called by `createBookingRequest`), which also has server-side validation.
/** Parses typed dates/times without forcing ISO (PickMe-style free text). */
function parseFlexibleDateTime(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (Number.isFinite(ms)) return ms;
  return null;
}

const PLACE_MAX_LEN = 120;
const MAX_FARE_LKR = 500_000;

/** Client-side ride search checks. Booking API: `letgo-driver-module/controllers/bookingController.js` → `createBookingRequest`. */
function validateRideSearch(input: {
  pickup: string;
  dropoff: string;
  maxPrice: string;
  earliest: string;
  latest: string;
}): string[] {
  const errs: string[] = [];
  const p = input.pickup.trim();
  const d = input.dropoff.trim();

  if (p.length > PLACE_MAX_LEN || d.length > PLACE_MAX_LEN) {
    errs.push(`Pickup and destination must be at most ${PLACE_MAX_LEN} characters each.`);
  }

  if (p.length === 1 || d.length === 1) {
    errs.push("Use at least 2 letters for pickup and destination, or leave both empty to see all trips.");
  }
  if (p.length >= 2 && !d) {
    errs.push("Add a destination, or clear pickup to browse all trips.");
  }
  if (d.length >= 2 && !p) {
    errs.push("Add a pickup point, or clear destination to browse all trips.");
  }

  if (p.length >= 2 && d.length >= 2 && p.toLowerCase() === d.toLowerCase()) {
    errs.push("Pickup and destination must be two different places.");
  }

  const mp = input.maxPrice.trim();
  if (mp) {
    const n = Number(mp.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 0) errs.push("Max fare must be a valid amount in LKR (e.g. 500).");
    else if (n > 0 && n < 10) errs.push("Max fare must be at least LKR 10, or leave empty for no limit.");
    else if (n > MAX_FARE_LKR) errs.push(`Max fare cannot exceed LKR ${MAX_FARE_LKR.toLocaleString("en-LK")}.`);
  }

  const e = input.earliest.trim();
  const l = input.latest.trim();
  if (e) {
    const t = parseFlexibleDateTime(e);
    if (t === null) {
      errs.push(
        'Earliest time: use a clear date & time (e.g. "2026-03-28 8:00 AM" or "2026-03-28T08:00:00").'
      );
    }
  }
  if (l) {
    const t = parseFlexibleDateTime(l);
    if (t === null) {
      errs.push(
        'Latest time: use a clear date & time (e.g. "2026-03-28 6:00 PM" or "2026-03-28T18:00:00").'
      );
    }
  }
  if (e && l) {
    const a = parseFlexibleDateTime(e);
    const b = parseFlexibleDateTime(l);
    if (a !== null && b !== null && a > b) {
      errs.push("Earliest time must be before or equal to latest time.");
    }
  }
  return errs;
}

function shortDriverLabel(driverId: string): string {
  const s = driverId.replace(/[^a-zA-Z0-9]/g, "");
  if (s.length <= 4) return `Driver ${s || "—"}`;
  return `Driver ·••${s.slice(-4)}`;
}

/** Rough ETA for UI (no live GPS); uses route distance from trip when available. */
function pickMeEtaLine(distanceKm: number): string {
  const km = Math.max(0, Number(distanceKm) || 0);
  const etaMin = Math.max(3, Math.round(4 + km * 2.2));
  if (km <= 0) return `~${etaMin} min · route distance updating`;
  return `~${etaMin} min · ~${km.toFixed(1)} km route`;
}

async function openGoogleMaps(pickup: string, dropoff: string) {
  const p = pickup.trim();
  const d = dropoff.trim();
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

type AppliedRideSearch = {
  pickup: string;
  dropoff: string;
  maxPrice: string;
  earliest: string;
  latest: string;
};

const EMPTY_APPLIED: AppliedRideSearch = {
  pickup: "",
  dropoff: "",
  maxPrice: "",
  earliest: "",
  latest: "",
};

export default function Booking() {
  const insets = useSafeAreaInsets();
  const { trips, loadingTrips, tripsError } = useBookingStore();
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [earliest, setEarliest] = useState<string>("");
  const [latest, setLatest] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<AppliedRideSearch>(EMPTY_APPLIED);
  const [searchErrors, setSearchErrors] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    loadTrips();
    // Also load bookings so we can show the current ride banner (PickMe-style).
    void loadBookingsHistory().catch(() => {});
  }, []);

  useEffect(() => {
    void getAuthSession().then((s) => setSignedIn(!!s?.user?.id));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void getAuthSession().then((s) => setSignedIn(!!s?.user?.id));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTrips();
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setSearchErrors([]);
  }, [pickup, dropoff, maxPrice, earliest, latest]);

  const draftValidation = useMemo(
    () => validateRideSearch({ pickup, dropoff, maxPrice, earliest, latest }),
    [pickup, dropoff, maxPrice, earliest, latest]
  );

  const hasTypedFilters =
    pickup.trim().length > 0 ||
    dropoff.trim().length > 0 ||
    maxPrice.trim().length > 0 ||
    earliest.trim().length > 0 ||
    latest.trim().length > 0;

  const showDraftValidation = draftValidation.length > 0 && hasTypedFilters;

  /** PickMe-style: when pickup, destination & options are valid, apply search automatically (no need to tap every time). */
  useEffect(() => {
    const t = setTimeout(() => {
      const errs = validateRideSearch({ pickup, dropoff, maxPrice, earliest, latest });
      if (errs.length) return;
      setSearchErrors([]);
      setAppliedSearch({ pickup, dropoff, maxPrice, earliest, latest });
    }, 480);
    return () => clearTimeout(t);
  }, [pickup, dropoff, maxPrice, earliest, latest]);

  const handleSubmitSearch = useCallback(() => {
    const errs = validateRideSearch({ pickup, dropoff, maxPrice, earliest, latest });
    if (errs.length) {
      setSearchErrors(errs);
      return;
    }
    setSearchErrors([]);
    setAppliedSearch({
      pickup,
      dropoff,
      maxPrice,
      earliest,
      latest,
    });
    Keyboard.dismiss();
  }, [pickup, dropoff, maxPrice, earliest, latest]);

  /** Nearest-first: shorter route distance, then cheaper fare (Uber / PickMe style). */
  const nearbyRides = useMemo(() => {
    const list = trips.filter((t) => {
      const pf = appliedSearch.pickup.trim().toLowerCase();
      const pd = appliedSearch.dropoff.trim().toLowerCase();
      const matchesFrom = pf ? t.from.toLowerCase().includes(pf) : true;
      const matchesTo = pd ? t.to.toLowerCase().includes(pd) : true;
      const mp = appliedSearch.maxPrice.trim().replace(/,/g, "");
      const matchesPrice = mp && !Number.isNaN(Number(mp)) ? t.price <= Number(mp) : true;

      const startMs = appliedSearch.earliest ? parseFlexibleDateTime(appliedSearch.earliest) : null;
      const endMs = appliedSearch.latest ? parseFlexibleDateTime(appliedSearch.latest) : null;
      const matchesTime =
        (startMs !== null ? t.departureTimeMs >= startMs : true) &&
        (endMs !== null ? t.departureTimeMs <= endMs : true);

      return matchesFrom && matchesTo && matchesPrice && matchesTime;
    });
    return [...list].sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      if (a.price !== b.price) return a.price - b.price;
      return a.departureTimeMs - b.departureTimeMs;
    });
  }, [trips, appliedSearch]);

  const { bookings } = useBookingStore();
  const currentRide: BookingRecord | null = useMemo(() => {
    const upcoming = bookings.filter((b) => b.status === "upcoming");
    if (!upcoming.length) return null;
    // Prefer accepted / paid bookings over plain pending.
    const preferred = upcoming.find((b) => {
      const raw = (b.rawStatus ?? "").toLowerCase();
      return raw === "accepted" || raw === "paid";
    });
    return preferred ?? upcoming[0];
  }, [bookings]);

  const listHeader = (
    <>
      <View style={styles.header}>
        <ScreenHeader
          showBack
          title="Book a ride"
          subtitle="Enter pickup & where to — nearby drivers update automatically (PickMe-style)."
          right={<ProfileAvatar size={52} />}
        />
      </View>

      {currentRide ? (
        <Pressable onPress={() => router.push("/trip-history")} accessibilityRole="button">
          <AppCard style={styles.currentRideCard} padded>
            <View style={styles.currentRideRow}>
              <View style={styles.currentRideIconWrap}>
                <Ionicons name="car-sport" size={18} color={BrandColors.primaryDark} />
              </View>
              <View style={styles.currentRideTextWrap}>
                <Text style={styles.currentRideTitle}>Current ride in progress</Text>
                <Text style={styles.currentRideSub} numberOfLines={2}>
                  Tap to view driver status and booking details.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={BrandColors.textMuted} />
            </View>
          </AppCard>
        </Pressable>
      ) : null}

      <AppCard style={styles.filtersCard}>
        <View style={styles.cardHead}>
          <View style={styles.cardHeadIcon}>
            <Ionicons name="navigate-circle" size={22} color={BrandColors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heading}>Your ride</Text>
            <Text style={styles.cardSub}>
              Type pickup & destination — the list below updates when your search is valid. Use Search rides to refresh or
              after errors.
            </Text>
          </View>
        </View>

        {searchErrors.length > 0 ? (
          <View style={styles.bookingValidationBox} accessibilityLiveRegion="polite">
            <Text style={styles.bookingValidationTitle}>Search validation</Text>
            {searchErrors.map((line, i) => (
              <Text key={`${line}-${i}`} style={styles.bookingValidationLine}>
                • {line}
              </Text>
            ))}
          </View>
        ) : showDraftValidation ? (
          <View style={styles.draftValidationBox} accessibilityLiveRegion="polite">
            <Text style={styles.draftValidationTitle}>Fix these to update the ride list</Text>
            {draftValidation.map((line, i) => (
              <Text key={`draft-${line}-${i}`} style={styles.draftValidationLine}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}

        {signedIn === false ? (
          <View style={styles.authNotice} accessibilityRole="alert">
            <Text style={styles.authNoticeText}>Sign in so your booking is linked to your account.</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(auth)", params: { tab: "login" } })}
              accessibilityRole="button"
              accessibilityLabel="Go to login"
            >
              <Text style={styles.authNoticeLink}>Go to Login</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.locationBlock}>
          <View style={styles.locationRow}>
            <View style={styles.dotPickup} />
            <View style={styles.locationField}>
              <FormTextInput
                label="Pickup"
                placeholder="e.g. Kottawa, Main Gate, your hostel…"
                value={pickup}
                onChangeText={setPickup}
                containerStyle={styles.noBottomMargin}
              />
            </View>
          </View>
          <View style={styles.dashedLine} />
          <View style={styles.locationRow}>
            <View style={styles.dotDrop} />
            <View style={styles.locationField}>
              <FormTextInput
                label="Where to?"
                placeholder="e.g. SLIIT Malabe, Liberty Plaza…"
                value={dropoff}
                onChangeText={setDropoff}
                containerStyle={styles.noBottomMargin}
              />
            </View>
          </View>
        </View>

        <Pressable
          style={styles.mapButton}
          onPress={() => void openGoogleMaps(pickup, dropoff)}
          accessibilityRole="button"
          accessibilityLabel="Open map"
          accessibilityHint="Opens Google Maps with your pickup and destination when filled"
        >
          <View style={styles.mapButtonIcon}>
            <Ionicons name="map" size={20} color={BrandColors.primaryDark} />
          </View>
          <View style={styles.mapButtonTextWrap}>
            <Text style={styles.mapButtonTitle}>Open in Maps</Text>
            <Text style={styles.mapButtonSub}>
              {pickup.trim() && dropoff.trim()
                ? "Directions between pickup & destination"
                : dropoff.trim()
                  ? "Search destination in Google Maps"
                  : pickup.trim()
                    ? "Search pickup in Google Maps"
                    : "Opens Maps — add locations above for directions"}
            </Text>
          </View>
          <Ionicons name="open-outline" size={20} color={BrandColors.textMuted} />
        </Pressable>

        <FormTextInput
          label="Max fare (LKR)"
          placeholder="Optional — hide trips above this price"
          keyboardType="decimal-pad"
          value={maxPrice}
          onChangeText={setMaxPrice}
          containerStyle={{ marginBottom: Space.sm }}
        />

        <Pressable
          style={styles.scheduleToggle}
          onPress={() => setShowSchedule((s) => !s)}
          accessibilityRole="button"
        >
          <Ionicons name="time-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.scheduleToggleText}>{showSchedule ? "Hide schedule filters" : "Schedule (optional)"}</Text>
          <Ionicons name={showSchedule ? "chevron-up" : "chevron-down"} size={18} color={BrandColors.textMuted} />
        </Pressable>

        {showSchedule ? (
          <>
            <Text style={styles.hint}>Filter by when the driver leaves. You can type in plain English or ISO.</Text>
            <FormTextInput
              label="Earliest departure"
              placeholder='e.g. today 1pm or 2026-03-28T08:00:00'
              autoCapitalize="none"
              value={earliest}
              onChangeText={setEarliest}
              containerStyle={{ marginBottom: Space.sm }}
            />
            <FormTextInput
              label="Latest departure"
              placeholder='e.g. 2026-03-28T18:00:00'
              autoCapitalize="none"
              value={latest}
              onChangeText={setLatest}
            />
          </>
        ) : null}

        <Text style={styles.submitHint}>
          Nearby drivers sort by shortest route first. Tap Search rides if the list doesn’t update.
        </Text>
        <PrimaryButton
          title="Search rides"
          onPress={handleSubmitSearch}
          style={styles.submitSearchBtn}
        />
      </AppCard>

      <View style={styles.resultsSection}>
        <Text style={styles.resultsTitle}>Nearby drivers</Text>
        <Text style={styles.resultsSub}>
          Drivers on matching trips — closest route first. Live GPS tracking requires drivers to go online.
        </Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + Space.sm }]}>
      <FlatList
        style={styles.listFlex}
        data={nearbyRides}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BrandColors.primary}
            colors={[BrandColors.primary]}
          />
        }
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <TripRow trip={item} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {loadingTrips
                ? "Finding trips…"
                : tripsError
                  ? "Something went wrong"
                  : "No drivers / rides yet"}
            </Text>
            <Text style={styles.emptyText}>
              {loadingTrips
                ? "Please wait…"
                : tripsError
                  ? tripsError
                  : trips.length === 0
                    ? "When drivers publish routes, they’ll show here. Pull down to refresh."
                    : "Try broader pickup/destination (e.g. “Malabe”, “SLIIT”) or raise max fare. List updates when the search is valid."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function TripRow({ trip }: { trip: Trip }) {
  const bookable = trip.seatsAvailable > 0;
  return (
    <AppCard style={styles.tripCard} padded>
      <View style={styles.uberTop}>
        <View style={styles.uberLeft}>
          <View style={styles.uberDriverRow}>
            <Ionicons name="person-circle-outline" size={22} color={BrandColors.primaryDark} />
            <Text style={styles.uberDriverName}>
              {trip.driverName ? trip.driverName : shortDriverLabel(trip.driverId)}
            </Text>
          </View>
          <Text style={styles.uberEta}>
            {pickMeEtaLine(trip.distanceKm)}
            {trip.vehicleType ? ` · ${trip.vehicleType}` : ""}
            {trip.vehicleNumber ? ` · ${trip.vehicleNumber}` : ""}
          </Text>
        </View>
        <View style={styles.uberPriceBlock}>
          <Text style={styles.uberPriceLabel}>Est. fare</Text>
          <Text style={styles.uberPrice}>LKR {trip.price.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.uberRouteBlock}>
        <View style={styles.uberRouteLine}>
          <View style={styles.dotPickupSmall} />
          <Text style={styles.uberRouteText} numberOfLines={2}>
            {trip.from}
          </Text>
        </View>
        <View style={styles.uberRouteLine}>
          <View style={styles.dotDropSmall} />
          <Text style={styles.uberRouteText} numberOfLines={2}>
            {trip.to}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>
        PickMe-style ride · {trip.time} start · {trip.seatsAvailable}/{trip.seatsTotal} seats free
      </Text>
      <PrimaryButton
        title={bookable ? "Book ride" : "Fully booked"}
        onPress={() => router.push({ pathname: "/seat-selection", params: { tripId: trip.id } })}
        disabled={!bookable}
        style={styles.bookBtn}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ScreenBg.light },
  header: {
    paddingBottom: Space.sm,
    paddingHorizontal: Layout.screenPaddingX - 2,
  },
  filtersCard: {
    marginTop: Space.md,
    marginHorizontal: Layout.screenPaddingX - 2,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    marginBottom: Space.md,
  },
  cardHeadIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 17, fontWeight: "900", color: BrandColors.primaryDark },
  cardSub: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
  bookingValidationBox: {
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
  },
  bookingValidationTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#B00020",
    marginBottom: Space.xs,
  },
  bookingValidationLine: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textDark,
    lineHeight: 18,
    marginTop: 2,
  },
  draftValidationBox: {
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(230, 126, 0, 0.45)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
  },
  draftValidationTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#C05600",
    marginBottom: Space.xs,
  },
  draftValidationLine: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textDark,
    lineHeight: 18,
    marginTop: 2,
  },
  authNotice: {
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Space.md,
    marginBottom: Space.sm,
    gap: Space.xs,
  },
  authNoticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: BrandColors.textDark,
    lineHeight: 19,
  },
  authNoticeLink: {
    fontSize: 13,
    fontWeight: "800",
    color: BrandColors.primary,
    textDecorationLine: "underline",
  },
  locationBlock: {
    marginBottom: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.xs,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
  },
  locationField: { flex: 1 },
  noBottomMargin: { marginBottom: 0 },
  dotPickup: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrandColors.success,
    marginTop: 36,
  },
  dotDrop: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: BrandColors.primary,
    marginTop: 36,
  },
  dashedLine: {
    marginLeft: 5,
    width: 2,
    height: 14,
    borderLeftWidth: 2,
    borderStyle: "dashed",
    borderColor: BrandColors.border,
    marginVertical: 2,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    marginBottom: Space.sm,
    backgroundColor: BrandColors.white,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: BrandColors.primary,
  },
  mapButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonTextWrap: { flex: 1 },
  mapButtonTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: BrandColors.primaryDark,
  },
  mapButtonSub: {
    fontSize: 11,
    fontWeight: "600",
    color: BrandColors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  scheduleToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    paddingVertical: Space.sm,
    marginBottom: Space.xs,
  },
  scheduleToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: BrandColors.primaryDark,
  },
  hint: {
    fontSize: 12,
    color: BrandColors.textMuted,
    marginBottom: Space.sm,
    lineHeight: 17,
  },
  submitHint: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 17,
    marginBottom: Space.sm,
  },
  submitSearchBtn: {
    marginTop: 0,
    width: "100%",
    minHeight: 52,
    borderRadius: Radii.pill,
    marginBottom: Space.md,
  },
  listFlex: { flex: 1 },
  listContent: { paddingHorizontal: Layout.screenPaddingX - 2, paddingTop: 0 },
  resultsSection: {
    marginTop: Space.sm,
    marginBottom: Space.sm,
    paddingHorizontal: 2,
  },
  resultsTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: BrandColors.primaryDark,
  },
  resultsSub: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
  tripCard: {
    marginBottom: Space.md,
  },
  currentRideCard: {
    marginTop: Space.sm,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.accentSoft,
  },
  currentRideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  currentRideIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  currentRideTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  currentRideTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: BrandColors.primaryDark,
  },
  currentRideSub: {
    fontSize: 12,
    color: BrandColors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  uberTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Space.md,
    marginBottom: Space.md,
  },
  uberLeft: { flex: 1 },
  uberDriverRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  uberDriverName: {
    fontSize: 16,
    fontWeight: "900",
    color: BrandColors.primaryDark,
  },
  uberEta: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    marginTop: 4,
    lineHeight: 17,
  },
  uberPriceBlock: { alignItems: "flex-end" },
  uberPriceLabel: { fontSize: 10, fontWeight: "700", color: BrandColors.textMuted, textTransform: "uppercase" },
  uberPrice: { fontSize: 22, fontWeight: "900", color: BrandColors.primaryDark, marginTop: 2 },
  uberRouteBlock: {
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.sm,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.md,
    marginBottom: Space.sm,
  },
  uberRouteLine: { flexDirection: "row", alignItems: "flex-start", gap: Space.sm },
  dotPickupSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.success,
    marginTop: 5,
  },
  dotDropSmall: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: BrandColors.primary,
    marginTop: 5,
  },
  uberRouteText: { flex: 1, fontSize: 14, fontWeight: "700", color: BrandColors.textDark, lineHeight: 20 },
  meta: { fontSize: 13, color: BrandColors.textLight, marginTop: Space.sm },
  bookBtn: { marginTop: Space.md, width: "100%" },
  emptyWrap: { marginTop: 28, paddingHorizontal: 12 },
  emptyTitle: {
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    marginBottom: Space.sm,
  },
  emptyText: {
    textAlign: "center",
    color: BrandColors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
});
