import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { AppCard } from "@/app/_components/ui/AppCard";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { getDriverSession, setDriverSession } from "@/app/_state/driverSession";

function validateDriverProfileDetails(input: {
  driverName: string;
  vehicleNumber: string;
  vehicleType: string;
  licenseNumber: string;
  currentVehicle: string;
}): string[] {
  const errs: string[] = [];
  const name = input.driverName.trim();
  if (!name) errs.push("Driver name is required");
  else if (name.length < 2) errs.push("Driver name must be at least 2 characters");

  const plate = input.vehicleNumber.trim();
  if (!plate) errs.push("Vehicle number is required");
  else if (plate.length < 2) errs.push("Vehicle number looks too short");

  const vtype = input.vehicleType.trim();
  if (!vtype) errs.push("Vehicle type is required");
  else if (vtype.length < 2) errs.push("Vehicle type must be at least 2 characters");

  const lic = input.licenseNumber.trim();
  if (!lic) errs.push("Driving licence number is required");
  else if (lic.length < 4) errs.push("Driving licence number looks too short");
  else if (lic.length > 32) errs.push("Driving licence number looks too long");
  else if (!/^[A-Za-z0-9][A-Za-z0-9\-/\s]*$/.test(lic)) {
    errs.push("Driving licence: use letters, digits, spaces, / or - only");
  }

  const cur = input.currentVehicle.trim();
  if (!cur) errs.push("Current vehicle is required");
  else if (cur.length < 2) errs.push("Current vehicle description must be at least 2 characters");

  return errs;
}

/** Inline driver vehicle / ID / availability form for the Driver hub tab. */
export function DriverProfileFormCard() {
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [currentVehicle, setCurrentVehicle] = useState("");
  const [showLocation, setShowLocation] = useState(false);
  const [availability, setAvailability] = useState(true);
  const [detailsErrors, setDetailsErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const session = await getDriverSession();
    if (session?.fullName) setDriverName(session.fullName);
    try {
      const apiBaseUrl = getApiBaseUrl();
      const auth = await getAuthSession();
      const headers: Record<string, string> = {};
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${apiBaseUrl}/api/drivers/me`, { headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.driver) return;

      const d = body.driver;
      if (d?.profile?.fullName) setDriverName(String(d.profile.fullName));
      if (d?.profile?.vehicleNumber) setVehicleNumber(String(d.profile.vehicleNumber));
      if (d?.profile?.vehicleType) setVehicleType(String(d.profile.vehicleType));
      if (d?.profile?.licenseNumber) setLicenseNumber(String(d.profile.licenseNumber));
      if (d?.profile?.currentVehicle) setCurrentVehicle(String(d.profile.currentVehicle));
      if (typeof d?.profile?.showLocation === "boolean") setShowLocation(!!d.profile.showLocation);
      if (typeof d?.profile?.availability === "boolean") setAvailability(!!d.profile.availability);
    } catch {
      /* session fallback only */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  useEffect(() => {
    setDetailsErrors([]);
  }, [driverName, vehicleNumber, vehicleType, licenseNumber, currentVehicle, showLocation, availability]);

  const onSaveProfile = async () => {
    const errs = validateDriverProfileDetails({
      driverName,
      vehicleNumber,
      vehicleType,
      licenseNumber,
      currentVehicle,
    });
    if (errs.length) {
      setDetailsErrors(errs);
      return;
    }
    setDetailsErrors([]);

    try {
      setSaving(true);
      const apiBaseUrl = getApiBaseUrl();
      const session = await getAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.token) headers.Authorization = `Bearer ${session.token}`;

      const res = await fetch(`${apiBaseUrl}/api/drivers/me`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          driverName,
          vehicleNumber,
          vehicleType,
          licenseNumber,
          currentVehicle,
          showLocation,
          availability,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to save profile");

      const latestName = String(body?.driver?.profile?.fullName ?? driverName);
      const local = await getDriverSession();
      if (local?.driverId) {
        await setDriverSession({
          driverId: local.driverId,
          email: local.email,
          fullName: latestName,
        });
      }

      Alert.alert(
        "Saved",
        `Profile updated.\nAvailable for rides: ${availability ? "Yes" : "No"}\nLocation: ${showLocation ? "On" : "Off"}`
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppCard style={styles.wrap} padded>
      <View style={styles.titleRow}>
        <Ionicons name="person-circle-outline" size={22} color={BrandColors.primaryDark} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>My driver details</Text>
          <Text style={styles.cardSub}>Vehicle, driving licence number, location & availability</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.fieldHalf}>
          <View style={styles.labelRow}>
            <Ionicons name="person-outline" size={14} color={BrandColors.primary} />
            <Text style={styles.label}>Driver name</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={driverName}
            onChangeText={setDriverName}
            placeholderTextColor={BrandColors.textMuted}
          />
        </View>
        <View style={styles.fieldHalf}>
          <View style={styles.labelRow}>
            <MaterialIcons name="directions-car" size={14} color={BrandColors.primary} />
            <Text style={styles.label}>Vehicle number</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Plate"
            value={vehicleNumber}
            onChangeText={setVehicleNumber}
            placeholderTextColor={BrandColors.textMuted}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.fieldHalf}>
          <View style={styles.labelRow}>
            <Ionicons name="car-outline" size={12} color={BrandColors.primary} />
            <Text style={styles.label}>Vehicle type</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Car / van…"
            value={vehicleType}
            onChangeText={setVehicleType}
            placeholderTextColor={BrandColors.textMuted}
          />
        </View>
        <View style={styles.fieldHalf}>
          <View style={styles.labelRow}>
            <Ionicons name="card-outline" size={14} color={BrandColors.primary} />
            <Text style={styles.label}>Driving licence no.</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. B 1234567"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholderTextColor={BrandColors.textMuted}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.fullField}>
        <View style={styles.labelRow}>
          <MaterialIcons name="local-taxi" size={14} color={BrandColors.primary} />
          <Text style={styles.label}>Current vehicle</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Description"
          value={currentVehicle}
          onChangeText={setCurrentVehicle}
          placeholderTextColor={BrandColors.textMuted}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleTitle}>Share location with passengers</Text>
        <Switch
          value={showLocation}
          onValueChange={setShowLocation}
          trackColor={{ false: BrandColors.border, true: BrandColors.accentSoft }}
          thumbColor={showLocation ? BrandColors.primary : BrandColors.surface}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleTitle}>Available for ride requests</Text>
        <Switch
          value={availability}
          onValueChange={setAvailability}
          trackColor={{ false: BrandColors.border, true: BrandColors.accentSoft }}
          thumbColor={availability ? BrandColors.primary : BrandColors.surface}
        />
      </View>

      {detailsErrors.length > 0 ? (
        <View style={styles.validationBox}>
          <Text style={styles.validationTitle}>Fix the following</Text>
          {detailsErrors.map((line, i) => (
            <Text key={`${line}-${i}`} style={styles.validationLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        title={saving ? "Saving…" : "Save driver details"}
        onPress={() => void onSaveProfile()}
        style={{ marginTop: Space.md, minHeight: 48, borderRadius: Radii.pill }}
        disabled={saving}
      />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(193, 205, 216, 0.55)",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginBottom: Space.md },
  cardTitle: { fontSize: 17, fontWeight: "900", color: BrandColors.primaryDark },
  cardSub: { marginTop: 2, fontSize: 12, color: BrandColors.textMuted, lineHeight: 17 },
  row: { flexDirection: "row", gap: 10, marginBottom: 12 },
  fieldHalf: { flex: 1 },
  fullField: { marginBottom: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: "700", color: BrandColors.textDark },
  input: {
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.sm,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    color: BrandColors.textDark,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    gap: 12,
  },
  toggleTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: BrandColors.textDark },
  validationBox: {
    marginTop: Space.sm,
    padding: Space.md,
    borderRadius: Radii.md,
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
  },
  validationTitle: { fontSize: 12, fontWeight: "900", color: "#B00020", marginBottom: 6 },
  validationLine: { fontSize: 12, fontWeight: "600", color: BrandColors.textDark, marginTop: 2 },
});
