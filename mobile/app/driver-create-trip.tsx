import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { getApiBaseUrl } from "@/app/_state/api";
import { getDriverSession } from "@/app/_state/driverSession";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space } from "@/app/_theme/tokens";
import { router } from "expo-router";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";

export default function DriverCreateTrip() {
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverLabel, setDriverLabel] = useState<string>("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [departureTime, setDepartureTime] = useState("2026-03-25T08:00:00.000Z");
  const [seatLimit, setSeatLimit] = useState("4");
  const [pricePerSeat, setPricePerSeat] = useState("1500");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const session = await getDriverSession();
      if (session) {
        setDriverId(session.driverId);
        setDriverLabel(`${session.fullName} · ${session.email}`);
      }
    })();
  }, []);

  const onCreate = async () => {
    if (!pickupLocation || !destination || !departureTime || !seatLimit || !pricePerSeat) {
      Alert.alert("Missing details", "Please fill all fields.");
      return;
    }

    if (!driverId) {
      Alert.alert("Driver account required", "Create a driver account from the sign-up screen first.", [
        { text: "OK", onPress: () => router.push({ pathname: "/(auth)", params: { tab: "driver" } }) },
      ]);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/api/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId,
          pickupLocation,
          destination,
          departureTime,
          seatLimit: Number(seatLimit),
          pricePerSeat: Number(pricePerSeat),
        }),
      });

      const body = (await res.json().catch(() => ({}))) as { message?: string; trip?: { _id: string } };
      if (!res.ok) {
        throw new Error(body.message ?? `Trip create failed (${res.status})`);
      }

      Alert.alert("Trip created", "Trip was created successfully.", [
        {
          text: "Manage trip",
          onPress: () => router.push(`/driver-active-trip?tripId=${body.trip?._id ?? ""}`),
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create trip";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader
        showBack
        title="New trip"
        subtitle="Publish a route, schedule, seats, and price for passengers."
      />

      <AppCard style={[styles.statusCard, { marginTop: Space.lg }]}>
        <Text style={styles.statusLabel}>Driver session</Text>
        <Text style={styles.statusValue}>
          {driverLabel || "Not signed in — register as a driver first."}
        </Text>
      </AppCard>

      <AppCard style={{ marginTop: Space.md }}>
        <Text style={styles.sectionTitle}>Route &amp; schedule</Text>
        <FormTextInput
          label="Pickup"
          placeholder="e.g. Colombo Fort"
          value={pickupLocation}
          onChangeText={setPickupLocation}
          containerStyle={{ marginBottom: Space.sm }}
        />
        <FormTextInput
          label="Destination"
          placeholder="e.g. SLIIT Malabe"
          value={destination}
          onChangeText={setDestination}
        />
        <FormTextInput
          label="Departure (ISO 8601)"
          placeholder="2026-03-25T08:00:00.000Z"
          value={departureTime}
          onChangeText={setDepartureTime}
          autoCapitalize="none"
        />
      </AppCard>

      <AppCard style={{ marginTop: Space.md }}>
        <Text style={styles.sectionTitle}>Capacity & pricing</Text>
        <FormTextInput
          label="Seat limit"
          placeholder="4"
          keyboardType="numeric"
          value={seatLimit}
          onChangeText={setSeatLimit}
          containerStyle={{ marginBottom: Space.sm }}
        />
        <FormTextInput
          label="Price per seat (LKR)"
          placeholder="1500"
          keyboardType="numeric"
          value={pricePerSeat}
          onChangeText={setPricePerSeat}
        />
      </AppCard>

      <View style={{ marginTop: Space.lg, marginBottom: Space.xl }}>
        <PrimaryButton
          title={submitting ? "Creating…" : "Publish trip"}
          onPress={onCreate}
          disabled={submitting}
        />
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusValue: { marginTop: Space.xs, fontSize: 14, color: BrandColors.textDark, lineHeight: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    marginBottom: Space.xs,
  },
});
