import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import { BrandColors } from "@/app/_theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, Radii, ScreenBg, Space } from "@/app/_theme/tokens";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import {
  createBooking,
  ensureTripLoaded,
  useBookingStore,
  validateSeatSelectionForTrip,
} from "@/app/_state/bookingStore";
import { getAuthSession } from "@/app/_state/authSession";

function normalizeParam(id: string | string[] | undefined) {
  if (Array.isArray(id)) return id[0];
  return id;
}

export default function SeatSelection() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tripId?: string | string[] }>();
  const tripId = normalizeParam(params.tripId);
  const { trips, loadingTrips, tripsError } = useBookingStore();
  const trip = useMemo(() => (tripId ? trips.find((t) => t.id === tripId) : undefined), [trips, tripId]);
  const [selected, setSelected] = useState<number[]>([]);
  const [bookingErrors, setBookingErrors] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (tripId) {
      void ensureTripLoaded(tripId);
    }
  }, [tripId]);

  useEffect(() => {
    void getAuthSession().then((s) => setSignedIn(!!s?.user?.id));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void getAuthSession().then((s) => setSignedIn(!!s?.user?.id));
    }, [])
  );

  useEffect(() => {
    setBookingErrors([]);
  }, [selected]);

  if (!tripId) {
    return (
      <View style={[styles.center, { backgroundColor: ScreenBg.light }]}>
        <Text style={styles.muted}>No trip selected. Go back and pick a trip.</Text>
        <View style={{ marginTop: 16 }}>
          <PrimaryButton title="Back to booking" onPress={() => router.replace("/booking")} />
        </View>
      </View>
    );
  }

  if (loadingTrips && !trip) {
    return (
      <View style={[styles.center, { backgroundColor: ScreenBg.light }]}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={[styles.muted, { marginTop: 12 }]}>Loading trip…</Text>
      </View>
    );
  }

  if (tripsError && !trip) {
    return (
      <View style={[styles.center, { backgroundColor: ScreenBg.light }]}>
        <Text style={styles.errorTitle}>Could not load trip</Text>
        <Text style={styles.muted}>{tripsError}</Text>
        <View style={{ marginTop: 16, alignSelf: "stretch", maxWidth: 320 }}>
          <PrimaryButton title="Try again" onPress={() => void ensureTripLoaded(tripId)} />
        </View>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.center, { backgroundColor: ScreenBg.light }]}>
        <Text style={styles.errorTitle}>Trip not found</Text>
        <Text style={styles.muted}>
          This trip may have ended, the ID may be wrong, or it is no longer listed. Open the booking list and choose
          again.
        </Text>
        <View style={{ marginTop: 16, alignSelf: "stretch", maxWidth: 320 }}>
          <PrimaryButton title="Back to booking" onPress={() => router.replace("/booking")} />
        </View>
      </View>
    );
  }

  const toggleSeat = (n: number) => {
    setSelected((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  };

  const handleConfirm = async () => {
    const preflight = validateSeatSelectionForTrip(trip, selected);
    if (preflight.length) {
      setBookingErrors(preflight);
      return;
    }
    setBookingErrors([]);
    try {
      await createBooking(trip.id, selected);
      Alert.alert("Booking request sent", "Your booking request has been sent to the driver.", [
        {
          text: "OK",
          onPress: () => router.replace("/trip-history"),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Booking failed";
      setBookingErrors(message.split("\n").filter(Boolean));
    }
  };

  const totalSeats = Math.max(1, trip.seatsTotal);
  const taken = Math.min(totalSeats, trip.seatsTotal - trip.seatsAvailable);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: ScreenBg.light }}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: Space.lg + insets.top, paddingBottom: Space.xl + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.top}>
        <ScreenHeader
          showBack
          title="Select seats"
          subtitle={`${trip.from} → ${trip.to} · ${trip.time}`}
        />
        <Text style={styles.metaLine}>
          {trip.seatsAvailable} seats available · {taken} reserved
        </Text>
        {signedIn === false ? (
          <View style={styles.authNotice}>
            <Text style={styles.authNoticeText}>You must be signed in to send a booking to the driver.</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(auth)", params: { tab: "login" } })}
              accessibilityRole="button"
            >
              <Text style={styles.authNoticeLink}>Sign in</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <AppCard style={styles.seatCard}>
        <Text style={styles.seatCardLabel}>Tap seats to select</Text>
        {bookingErrors.length > 0 ? (
          <View style={styles.bookingValidationBox} accessibilityLiveRegion="polite">
            <Text style={styles.bookingValidationTitle}>Please fix the following</Text>
            {bookingErrors.map((line, i) => (
              <Text key={`${line}-${i}`} style={styles.bookingValidationLine}>
                • {line}
              </Text>
            ))}
          </View>
        ) : null}
        <View style={styles.grid}>
          {Array.from({ length: totalSeats }).map((_, idx) => {
            const n = idx + 1;
            const isSelected = selected.includes(n);
            const disabled = n <= taken;
            return (
              <Pressable
                key={n}
                onPress={() => !disabled && toggleSeat(n)}
                style={[
                  styles.seat,
                  disabled && styles.seatTaken,
                  isSelected && styles.seatSelected,
                ]}
              >
                <Text style={[styles.seatText, isSelected && styles.seatTextOnPrimary]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <View style={styles.footer}>
        <PrimaryButton
          title="Confirm selection"
          onPress={handleConfirm}
          disabled={signedIn === false}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  top: { marginBottom: Space.md },
  metaLine: { marginTop: Space.sm, fontSize: 13, color: BrandColors.textMuted },
  authNotice: {
    marginTop: Space.md,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Space.md,
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
  seatCard: { marginBottom: Space.lg },
  seatCardLabel: { fontSize: 12, fontWeight: "700", color: BrandColors.textMuted, marginBottom: Space.md },
  bookingValidationBox: {
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.md,
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  muted: { color: BrandColors.textLight, textAlign: "center", fontSize: 14, lineHeight: 20 },
  errorTitle: { fontSize: 18, fontWeight: "800", color: BrandColors.primaryDark, marginBottom: 8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: Space.md,
    columnGap: Space.xs,
  },
  seat: {
    width: "23%",
    height: 56,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  seatTaken: {
    backgroundColor: "#D3DCE8",
    borderColor: "#D3DCE8",
  },
  seatSelected: {
    backgroundColor: BrandColors.primaryDark,
    borderColor: BrandColors.primaryDark,
  },
  seatText: { fontSize: 16, fontWeight: "800", color: BrandColors.textDark },
  seatTextOnPrimary: { color: BrandColors.white },
  footer: { marginTop: Space.md },
});

