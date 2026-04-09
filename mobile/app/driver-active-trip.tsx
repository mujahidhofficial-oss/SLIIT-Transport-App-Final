import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Space, Typography } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { getDriverSession } from "@/app/_state/driverSession";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";

const Maps = Platform.OS === "web" ? null : require("react-native-maps");
const MapView = Maps?.default;
const Marker = Maps?.Marker;
const Polyline = Maps?.Polyline;

type LatLng = { lat: number; lng: number };

type RideDetailJson = {
  driverAtPickup?: boolean;
  pickup?: { lat?: number; lng?: number; address?: string };
  dropoff?: { lat?: number; lng?: number; address?: string };
};

function coordFromPlace(p?: { lat?: number; lng?: number } | null): LatLng | null {
  const lat = Number(p?.lat);
  const lng = Number(p?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function openDirectionsTo(label: "pickup" | "drop", coord: LatLng | null, addressFallback: string) {
  try {
    if (coord) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coord.lat},${coord.lng}`;
      await Linking.openURL(url);
      return;
    }
    const q = addressFallback.trim();
    if (q) {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
      return;
    }
    Alert.alert("Directions", label === "pickup" ? "No pickup location to open in Maps." : "No drop-off location.");
  } catch {
    Alert.alert("Directions", "Could not open Maps. Try again or search the address manually.");
  }
}

function normalizeParam(id: string | string[] | undefined) {
  if (Array.isArray(id)) return id[0] ?? "";
  return id ?? "";
}

export default function DriverActiveTrip() {
  const params = useLocalSearchParams<{
    tripId?: string | string[];
    requestId?: string | string[];
    pickup?: string | string[];
    drop?: string | string[];
    distance?: string | string[];
    price?: string | string[];
    customerName?: string | string[];
    customerContact?: string | string[];
  }>();
  const [tripId, setTripId] = useState(normalizeParam(params.tripId));
  const requestId = normalizeParam(params.requestId);
  const pickup = normalizeParam(params.pickup);
  const drop = normalizeParam(params.drop);
  const distance = normalizeParam(params.distance);
  const price = normalizeParam(params.price);
  const customerName = normalizeParam(params.customerName);
  const customerContact = normalizeParam(params.customerContact);
  const [lat, setLat] = useState("6.9271");
  const [lng, setLng] = useState("79.8612");
  const [driverAtPickup, setDriverAtPickup] = useState(false);
  const [markingPickup, setMarkingPickup] = useState(false);
  const [pickupCoord, setPickupCoord] = useState<LatLng | null>(null);
  const [dropCoord, setDropCoord] = useState<LatLng | null>(null);
  const mapRef = useRef<{ fitToCoordinates: (...args: unknown[]) => void } | null>(null);

  useFocusEffect(
    useCallback(() => {
      void Location.requestForegroundPermissionsAsync();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (!requestId.trim()) return;
      void (async () => {
        const sess = await getDriverSession();
        const did = sess?.driverId?.trim() ?? "";
        if (!did) return;
        try {
          const res = await fetch(
            `${getApiBaseUrl()}/api/ride-requests/${encodeURIComponent(requestId)}?driverId=${encodeURIComponent(did)}`
          );
          const j = (await res.json().catch(() => ({}))) as RideDetailJson;
          if (res.ok) {
            setDriverAtPickup(!!j.driverAtPickup);
            setPickupCoord(coordFromPlace(j.pickup));
            setDropCoord(coordFromPlace(j.dropoff));
          }
        } catch {
          /* ignore */
        }
      })();
    }, [requestId])
  );

  const fitRouteToMarkers = useCallback(() => {
    if (Platform.OS === "web" || !pickupCoord) return;
    const map = mapRef.current;
    if (!map) return;
    const coords = [{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }];
    if (dropCoord) coords.push({ latitude: dropCoord.lat, longitude: dropCoord.lng });
    map.fitToCoordinates(coords, {
      edgePadding: { top: 52, right: 36, bottom: 36, left: 36 },
      animated: true,
    });
  }, [pickupCoord, dropCoord]);

  useEffect(() => {
    const t = setTimeout(fitRouteToMarkers, 300);
    return () => clearTimeout(t);
  }, [fitRouteToMarkers]);

  const markArrivedAtPickup = async () => {
    if (!requestId.trim()) return;
    try {
      setMarkingPickup(true);
      const auth = await getAuthSession();
      const sess = await getDriverSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/${encodeURIComponent(requestId)}/arrived-at-pickup`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ driverId: sess?.driverId ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Could not update pickup status");
      setDriverAtPickup(true);
      Alert.alert("Pickup", body.message ?? "Passenger will see you’ve arrived.");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Request failed");
    } finally {
      setMarkingPickup(false);
    }
  };

  const callTripEndpoint = async (path: string, method: "PUT", body?: object) => {
    if (!tripId.trim()) {
      Alert.alert("Trip ID", "Enter the trip you are operating.");
      return;
    }
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/trips/${tripId.trim()}/${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(payload.message ?? "Action failed");
      Alert.alert("Done", payload.message ?? "Updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      Alert.alert("Error", message);
    }
  };

  const completeRideRequest = async () => {
    if (!requestId.trim()) return;
    try {
      const auth = await getAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/${requestId.trim()}/complete`, {
        method: "PUT",
        headers,
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to complete ride");
      Alert.alert("Done", body.message ?? "Ride completed successfully.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore") },
      ]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to complete ride";
      Alert.alert("Error", msg);
    }
  };

  if (requestId) {
    return (
      <ScreenShell>
        <ScreenHeader
          showBack
          title="Active ride"
          subtitle="Customer accepted ride is now in progress."
        />

        <AppCard style={{ marginTop: Space.lg, overflow: "hidden", padding: 0 }}>
          <Text style={[styles.sectionTitle, styles.mapCardTitlePad]}>Route map</Text>
          <Text style={[styles.hint, styles.mapCardHintPad]}>
            Green = passenger pickup · Red = drop-off. Use navigation to open Google Maps with turn-by-turn.
          </Text>
          {pickupCoord && dropCoord && MapView && Marker && Polyline ? (
            <View style={styles.mapWrap}>
              <MapView
                ref={mapRef as never}
                style={styles.map}
                showsUserLocation
                showsMyLocationButton={false}
                onMapReady={fitRouteToMarkers}
                initialRegion={{
                  latitude: pickupCoord.lat,
                  longitude: pickupCoord.lng,
                  latitudeDelta: Math.max(0.04, Math.abs(pickupCoord.lat - dropCoord.lat) * 1.8 || 0.08),
                  longitudeDelta: Math.max(0.04, Math.abs(pickupCoord.lng - dropCoord.lng) * 1.8 || 0.08),
                }}
              >
                <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Pickup" pinColor="green" />
                <Marker coordinate={{ latitude: dropCoord.lat, longitude: dropCoord.lng }} title="Drop-off" pinColor="red" />
                <Polyline
                  coordinates={[
                    { latitude: pickupCoord.lat, longitude: pickupCoord.lng },
                    { latitude: dropCoord.lat, longitude: dropCoord.lng },
                  ]}
                  strokeColor={BrandColors.primaryDark}
                  strokeWidth={3}
                />
              </MapView>
            </View>
          ) : pickupCoord && MapView && Marker ? (
            <View style={styles.mapWrap}>
              <MapView
                ref={mapRef as never}
                style={styles.map}
                showsUserLocation
                onMapReady={fitRouteToMarkers}
                initialRegion={{
                  latitude: pickupCoord.lat,
                  longitude: pickupCoord.lng,
                  latitudeDelta: 0.06,
                  longitudeDelta: 0.06,
                }}
              >
                <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Pickup" pinColor="green" />
              </MapView>
            </View>
          ) : (
            <View style={styles.mapPlaceholder}>
              <MaterialIcons name="map" size={40} color={BrandColors.textLight} />
              <Text style={styles.mapPlaceholderText}>
                {Platform.OS === "web"
                  ? "Map runs on device builds. Use the buttons below to open Google Maps."
                  : pickup || drop
                    ? "Loading map… if this stays empty, use Navigate with the address."
                    : "No coordinates yet — use Navigate with addresses below."}
              </Text>
            </View>
          )}
          <View style={styles.navButtons}>
            <PrimaryButton
              title="Navigate to pickup"
              variant="outline"
              onPress={() => void openDirectionsTo("pickup", pickupCoord, pickup)}
            />
            <PrimaryButton
              title="Navigate to drop-off"
              variant="outline"
              onPress={() => void openDirectionsTo("drop", dropCoord, drop)}
            />
          </View>
        </AppCard>

        <AppCard style={{ marginTop: Space.lg }}>
          <Text style={styles.sectionTitle}>Ride summary</Text>
          <Text style={styles.hint}>Request ID · {requestId}</Text>
          <Text style={styles.hint}>Pickup · {pickup || "—"}</Text>
          <Text style={styles.hint}>Drop · {drop || "—"}</Text>
          <Text style={styles.hint}>Distance · {distance ? `${distance} km` : "—"}</Text>
          <Text style={styles.hint}>Est. fare · {price ? `LKR ${price}` : "—"}</Text>
          <Text style={styles.hint}>Customer · {customerName || "—"}</Text>
          {customerContact ? <Text style={styles.hint}>Contact · {customerContact}</Text> : null}
          {driverAtPickup ? (
            <View style={styles.pickupStatusOk}>
              <Text style={styles.pickupStatusOkText}>You’re marked at pickup — passenger notified.</Text>
            </View>
          ) : (
            <Text style={styles.hint}>When you reach the pickup point, tap the button below.</Text>
          )}
        </AppCard>

        <AppCard style={{ marginTop: Space.md }}>
          <Text style={styles.sectionTitle}>Pickup</Text>
          <PrimaryButton
            title={markingPickup ? "Updating…" : driverAtPickup ? "Already at pickup" : "I’m at pickup now"}
            onPress={() => void markArrivedAtPickup()}
            disabled={markingPickup || driverAtPickup}
          />
          {markingPickup ? (
            <ActivityIndicator style={{ marginTop: Space.sm }} color={BrandColors.primary} />
          ) : null}
        </AppCard>

        <AppCard style={{ marginTop: Space.md, marginBottom: Space.xl }}>
          <Text style={styles.sectionTitle}>Finish trip</Text>
          <Text style={styles.hint}>
            When passenger reaches destination, tap below to complete this ride.
          </Text>
          <PrimaryButton title="Finish trip" onPress={() => void completeRideRequest()} />
        </AppCard>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScreenHeader
        showBack
        title="Live trip"
        subtitle="Start the trip, send location updates, then end to run payments."
      />

      <AppCard style={{ marginTop: Space.lg }}>
        <FormTextInput
          label="Trip ID"
          placeholder="Trip _id"
          value={tripId}
          onChangeText={setTripId}
          autoCapitalize="none"
          containerStyle={{ marginBottom: Space.sm }}
        />
        <PrimaryButton title="Start trip" onPress={() => callTripEndpoint("start", "PUT")} />
      </AppCard>

      <AppCard style={{ marginTop: Space.md }}>
        <Text style={styles.sectionTitle}>Live location</Text>
        <Text style={styles.hint}>Send coordinates while the trip status is started.</Text>
        <FormTextInput
          label="Latitude"
          placeholder="6.9271"
          value={lat}
          onChangeText={setLat}
          keyboardType="decimal-pad"
          containerStyle={{ marginBottom: Space.sm }}
        />
        <FormTextInput
          label="Longitude"
          placeholder="79.8612"
          value={lng}
          onChangeText={setLng}
          keyboardType="decimal-pad"
          containerStyle={{ marginBottom: Space.md }}
        />
        <PrimaryButton
          title="Update location"
          onPress={() =>
            callTripEndpoint("location", "PUT", {
              lat: Number(lat),
              lng: Number(lng),
            })
          }
        />
      </AppCard>

      <AppCard style={{ marginTop: Space.md, marginBottom: Space.xl }}>
        <Text style={styles.sectionTitle}>Finish</Text>
        <Text style={styles.hint}>Ends the trip and runs the payment simulator for accepted bookings.</Text>
        <PrimaryButton title="End trip & process payments" onPress={() => callTripEndpoint("end", "PUT")} />
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    marginBottom: Space.xs,
  },
  hint: { fontSize: 12, color: BrandColors.textMuted, marginBottom: Space.sm, lineHeight: 17 },
  pickupStatusOk: {
    marginTop: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  pickupStatusOkText: { fontSize: 13, fontWeight: "700", color: "#15803d" },
  mapCardTitlePad: { paddingHorizontal: Space.md, marginTop: Space.md, marginBottom: 0 },
  mapCardHintPad: { paddingHorizontal: Space.md, marginBottom: Space.sm },
  mapWrap: {
    height: 240,
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceMuted,
  },
  map: { width: "100%", height: "100%" },
  mapPlaceholder: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    paddingHorizontal: Space.md,
    backgroundColor: BrandColors.surfaceMuted,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BrandColors.border,
  },
  mapPlaceholderText: {
    ...Typography.subhead,
    color: BrandColors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  navButtons: { padding: Space.md, gap: Space.sm },
});
