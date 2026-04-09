import React, { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { router } from "expo-router";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, Space, Typography } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { getDriverSession } from "@/app/_state/driverSession";

const Maps = Platform.OS === "web" ? null : require("react-native-maps");
const MapView = Maps?.default;
const Marker = Maps?.Marker;
const Polyline = Maps?.Polyline;

const PLACEHOLDER = BrandColors.textLight;
const DECLINE_BG = "#E85D5D";

export default function DriverTripActionScreen() {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [distance, setDistance] = useState("");
  const [price, setPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [submitBid, setSubmitBid] = useState("");
  const [serverBidLkr, setServerBidLkr] = useState<number | null>(null);
  const [serverBidDriverName, setServerBidDriverName] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [responding, setResponding] = useState(false);
  const [pickupCoord, setPickupCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [dropCoord, setDropCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerBidResponse, setPassengerBidResponse] = useState<"none" | "accepted" | "declined">("none");

  const hasActiveRequest = useMemo(() => requestId.trim().length > 0, [requestId]);

  const loadPendingRequest = async () => {
    try {
      setLoadingRequest(true);
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/pending`);
      const data = (await res.json().catch(() => [])) as any;
      if (!res.ok) throw new Error(data?.message || "Failed to load pending ride requests");
      const first = Array.isArray(data) ? data[0] : null;

      if (!first) {
        setRequestId("");
        setPickup("");
        setDrop("");
        setDistance("");
        setPrice("");
        setCustomerName("");
        setCustomerContact("");
        setPickupCoord(null);
        setDropCoord(null);
        setServerBidLkr(null);
        setServerBidDriverName(null);
        setPassengerBidResponse("none");
        return;
      }

      setRequestId(String(first.id ?? ""));
      setPickup(String(first.pickup?.address ?? ""));
      setDrop(String(first.dropoff?.address ?? ""));
      setDistance(Number.isFinite(Number(first.distanceKm)) ? Number(first.distanceKm).toFixed(1) : "");
      setPrice(Number.isFinite(Number(first.estimatedFareLkr)) ? Math.round(Number(first.estimatedFareLkr)).toString() : "");
      setCustomerName(String(first.customerName ?? first.customerId ?? "Customer"));
      setCustomerContact(String(first.customerPhone ?? ""));
      if (Number.isFinite(Number(first.pickup?.lat)) && Number.isFinite(Number(first.pickup?.lng))) {
        setPickupCoord({ lat: Number(first.pickup.lat), lng: Number(first.pickup.lng) });
      } else {
        setPickupCoord(null);
      }
      if (Number.isFinite(Number(first.dropoff?.lat)) && Number.isFinite(Number(first.dropoff?.lng))) {
        setDropCoord({ lat: Number(first.dropoff.lat), lng: Number(first.dropoff.lng) });
      } else {
        setDropCoord(null);
      }
      const bid = Math.round(Number((first as { driverBidLkr?: number }).driverBidLkr));
      setServerBidLkr(Number.isFinite(bid) && bid > 0 ? bid : null);
      setServerBidDriverName(
        (first as { driverBidDriverName?: string }).driverBidDriverName
          ? String((first as { driverBidDriverName?: string }).driverBidDriverName)
          : null
      );
      const pbr = String((first as { passengerBidResponse?: string }).passengerBidResponse ?? "").toLowerCase();
      setPassengerBidResponse(pbr === "accepted" || pbr === "declined" ? pbr : "none");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load pending requests");
    } finally {
      setLoadingRequest(false);
    }
  };

  useEffect(() => {
    void loadPendingRequest();
  }, []);

  useEffect(() => {
    const base = getApiBaseUrl();
    const socket: Socket = io(base, { transports: ["websocket"], forceNew: true });
    const rid = requestId.trim();

    const onPassenger = (payload: Record<string, unknown>) => {
      const id = String(payload?.requestId ?? "");
      if (!rid || id !== rid) return;
      const pbr = String(payload?.passengerBidResponse ?? "").toLowerCase();
      setPassengerBidResponse(pbr === "accepted" || pbr === "declined" ? pbr : "none");
    };

    const onBidUpdate = (payload: Record<string, unknown>) => {
      const id = String(payload?.requestId ?? "");
      if (!rid || id !== rid) return;
      const raw = payload?.passengerBidResponse;
      if (raw == null || String(raw).length === 0) return;
      const pbr = String(raw).toLowerCase();
      setPassengerBidResponse(pbr === "accepted" || pbr === "declined" ? pbr : "none");
    };

    socket.on("rideRequestBidPassengerResponse", onPassenger);
    socket.on("rideRequestBidUpdate", onBidUpdate);
    return () => {
      socket.off("rideRequestBidPassengerResponse", onPassenger);
      socket.off("rideRequestBidUpdate", onBidUpdate);
      socket.disconnect();
    };
  }, [requestId]);

  const onSubmitBids = async () => {
    const bidRaw = submitBid.trim();
    if (!bidRaw) {
      Alert.alert("Bid amount", "Enter your fare in LKR (numbers only).");
      return;
    }
    const amount = Math.round(Number(bidRaw.replace(/,/g, "")));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Bid amount", "Enter a valid amount in LKR.");
      return;
    }
    if (!requestId.trim()) {
      Alert.alert("No request", "Load a pending request first (Refresh).");
      return;
    }
    try {
      const session = await getDriverSession();
      const auth = await getAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/${encodeURIComponent(requestId)}/bid`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ bidAmountLkr: amount, driverId: session?.driverId ?? "" }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || "Could not send bid");
      setSubmitBid("");
      setServerBidLkr(amount);
      const nm = auth?.user?.profile && typeof auth.user.profile === "object" && "fullName" in auth.user.profile
        ? String((auth.user.profile as { fullName?: string }).fullName ?? "")
        : "";
      if (nm) setServerBidDriverName(nm);
      Alert.alert("Offer sent", "The passenger will see your fare on Request a driver — they can compare it with the app estimate.");
      await loadPendingRequest();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Bid failed");
    }
  };

  const onRespond = async (action: "accepted" | "declined") => {
    if (!requestId.trim()) {
      Alert.alert("No request", "No pending request loaded right now.");
      return;
    }
    try {
      setResponding(true);
      const session = await getDriverSession();
      const auth = await getAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/${requestId}/respond`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ action, driverId: session?.driverId ?? "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to update request");
      if (action === "accepted") {
        router.push({
          pathname: "/driver-active-trip",
          params: {
            requestId,
            pickup,
            drop,
            distance,
            price,
            customerName,
            customerContact,
          },
        });
      } else {
        Alert.alert("Ride declined", "Customer has been notified that this request was declined.");
        await loadPendingRequest();
      }
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update request");
    } finally {
      setResponding(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader
        showBack
        title="Trip action"
        subtitle="Load pending requests, accept or decline, preview the route."
      />

      <View style={styles.inner}>
        <View style={styles.card}>
          <View style={styles.liveRow}>
            <Text style={styles.liveTitle}>{hasActiveRequest ? "Live customer request loaded" : "No pending requests"}</Text>
            <PrimaryButton
              title={loadingRequest ? "Refreshing..." : "Refresh"}
              onPress={() => void loadPendingRequest()}
              style={styles.refreshBtn}
              disabled={loadingRequest || responding}
            />
          </View>
          {hasActiveRequest ? <Text style={styles.reqId}>Request ID: {requestId}</Text> : null}

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <Ionicons name="location-outline" size={12} color={BrandColors.primary} />
                <Text style={styles.label}>Pickup</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Select Pickup"
                placeholderTextColor={PLACEHOLDER}
                value={pickup}
                onChangeText={setPickup}
              />
            </View>

            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <Ionicons name="location" size={12} color={BrandColors.primary} />
                <Text style={styles.label}>Drop</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Select Drop"
                placeholderTextColor={PLACEHOLDER}
                value={drop}
                onChangeText={setDrop}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <MaterialIcons name="social-distance" size={12} color={BrandColors.primary} />
                <Text style={styles.label}>Distance</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Km"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="numeric"
                value={distance}
                onChangeText={setDistance}
              />
            </View>

            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <FontAwesome5 name="coins" size={11} color={BrandColors.primary} />
                <Text style={styles.label}>Price</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <Ionicons name="person-outline" size={12} color={BrandColors.primary} />
                <Text style={styles.label}>Customer Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Customer Name"
                placeholderTextColor={PLACEHOLDER}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            <View style={styles.fieldHalf}>
              <View style={styles.labelRow}>
                <Ionicons name="call-outline" size={12} color={BrandColors.primary} />
                <Text style={styles.label}>Customer Contact</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Customer/Contact number"
                placeholderTextColor={PLACEHOLDER}
                value={customerContact}
                onChangeText={setCustomerContact}
              />
            </View>
          </View>

          <View style={styles.submitSection}>
            <View style={styles.labelRow}>
              <Ionicons name="cash-outline" size={12} color={BrandColors.primary} />
              <Text style={styles.label}>Your fare offer (LKR)</Text>
            </View>
            <Text style={styles.bidHint}>
              Passenger app shows this next to the auto estimate while the request is still waiting — before you Accept or Decline.
            </Text>

            {serverBidLkr != null && serverBidLkr > 0 ? (
              <View style={styles.currentBidPill}>
                <Ionicons name="checkmark-circle" size={16} color={BrandColors.success} />
                <Text style={styles.currentBidText}>
                  Last offer on this request: LKR {serverBidLkr.toLocaleString("en-LK")}
                  {serverBidDriverName ? ` · ${serverBidDriverName}` : ""}
                </Text>
              </View>
            ) : null}

            {passengerBidResponse === "accepted" ? (
              <View style={styles.passengerReactPillOk}>
                <Ionicons name="happy-outline" size={16} color={BrandColors.success} />
                <Text style={styles.passengerReactText}>Passenger is OK with your fare</Text>
              </View>
            ) : passengerBidResponse === "declined" ? (
              <View style={styles.passengerReactPillNo}>
                <Ionicons name="remove-circle-outline" size={16} color={BrandColors.textMuted} />
                <Text style={styles.passengerReactTextMuted}>Passenger is not interested in this offer</Text>
              </View>
            ) : null}

            <View style={styles.submitRow}>
              <TextInput
                style={styles.submitInput}
                placeholder="e.g. 1850"
                placeholderTextColor={PLACEHOLDER}
                keyboardType="numeric"
                value={submitBid}
                onChangeText={setSubmitBid}
              />

              <TouchableOpacity style={styles.smallButton} onPress={() => void onSubmitBids()}>
                <Ionicons name="paper-plane-outline" size={14} color="#fff" />
                <Text style={styles.smallButtonText}>Send offer</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>Compare with demo bids</Text>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() =>
                router.push({
                  pathname: "/driver-submit-bids",
                  params: { estimate: price || "", requestId: requestId || "" },
                })
              }
            >
              <Text style={styles.smallButtonText}>See bids</Text>
              <Ionicons name="arrow-forward" size={14} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomButtons}>
            <TouchableOpacity
              style={[styles.actionButton, (!hasActiveRequest || responding) && styles.disabledBtn]}
              onPress={() => void onRespond("accepted")}
              disabled={!hasActiveRequest || responding}
            >
              <Text style={styles.actionButtonText}>{responding ? "Please wait..." : "Accept"}</Text>
              <Ionicons name="play-outline" size={14} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: DECLINE_BG },
                (!hasActiveRequest || responding) && styles.disabledBtn,
              ]}
              onPress={() => void onRespond("declined")}
              disabled={!hasActiveRequest || responding}
            >
              <Ionicons name="arrow-back" size={14} color="#fff" />
              <Text style={styles.actionButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapCard}>
            {pickupCoord && dropCoord && MapView && Marker && Polyline ? (
              <>
                <Text style={styles.mapTitle}>Mini map</Text>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: pickupCoord.lat,
                    longitude: pickupCoord.lng,
                    latitudeDelta: Math.max(0.03, Math.abs(pickupCoord.lat - dropCoord.lat) * 1.8),
                    longitudeDelta: Math.max(0.03, Math.abs(pickupCoord.lng - dropCoord.lng) * 1.8),
                  }}
                >
                  <Marker coordinate={{ latitude: pickupCoord.lat, longitude: pickupCoord.lng }} title="Pickup" pinColor="green" />
                  <Marker coordinate={{ latitude: dropCoord.lat, longitude: dropCoord.lng }} title="Drop" pinColor="red" />
                  <Polyline
                    coordinates={[
                      { latitude: pickupCoord.lat, longitude: pickupCoord.lng },
                      { latitude: dropCoord.lat, longitude: dropCoord.lng },
                    ]}
                    strokeColor={BrandColors.primaryDark}
                    strokeWidth={3}
                  />
                </MapView>
              </>
            ) : (
              <View style={styles.mapPlaceholder}>
                <MaterialIcons name="map" size={42} color={BrandColors.textLight} />
                <Text style={styles.mapPlaceholderText}>
                  {Platform.OS === "web" ? "Mini map is available on Android/iOS builds." : "Map will show here"}
                </Text>
              </View>
            )}
          </View>

          <PrimaryButton title="(Demo) Save trip" onPress={() => console.log("Save trip (demo)")} style={{ marginTop: Space.md }} />
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  inner: {
    paddingBottom: Space.xl,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  card: {
    width: "100%",
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.xl,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.55)",
    ...Elevated.soft,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
    marginBottom: Space.sm,
  },
  liveTitle: { ...Typography.caption, fontWeight: "800", color: BrandColors.primaryDark, flex: 1 },
  reqId: { fontSize: 11, color: BrandColors.textMuted, marginBottom: Space.sm },
  refreshBtn: { minHeight: 40, borderRadius: Radii.pill, paddingHorizontal: Space.md },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Space.sm,
    marginBottom: Space.md,
  },
  fieldHalf: { flex: 1 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 5 },
  label: { ...Typography.caption, fontWeight: "700", color: BrandColors.textDark },
  input: {
    minHeight: 40,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Space.sm,
    fontSize: 13,
    color: BrandColors.textDark,
  },
  submitSection: { marginBottom: Space.md },
  bidHint: {
    fontSize: 11,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 16,
    marginBottom: Space.sm,
  },
  passengerReactPillOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.sm,
    paddingVertical: 10,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: "rgba(25,169,116,0.1)",
    borderWidth: 1,
    borderColor: "rgba(25,169,116,0.35)",
  },
  passengerReactPillNo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.sm,
    paddingVertical: 10,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  passengerReactText: { flex: 1, fontSize: 12, fontWeight: "800", color: BrandColors.success },
  passengerReactTextMuted: { flex: 1, fontSize: 12, fontWeight: "700", color: BrandColors.textMuted },
  currentBidPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    padding: Space.sm,
    marginBottom: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: "rgba(13, 177, 75, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(13, 177, 75, 0.3)",
  },
  currentBidText: { flex: 1, fontSize: 12, fontWeight: "700", color: BrandColors.textDark },
  submitRow: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginTop: 4 },
  submitInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Space.sm,
    fontSize: 13,
    color: BrandColors.textDark,
  },
  smallButton: {
    minWidth: 96,
    minHeight: 40,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Space.md,
  },
  smallButtonText: { color: BrandColors.white, fontSize: 12, fontWeight: "800" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: Space.md,
    gap: Space.sm,
  },
  actionLabel: { fontSize: 12, color: BrandColors.textMuted, fontWeight: "600", flex: 1 },
  bottomButtons: { flexDirection: "row", justifyContent: "space-between", gap: Space.sm, marginBottom: Space.md },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionButtonText: { color: BrandColors.white, fontSize: 13, fontWeight: "800" },
  disabledBtn: { opacity: 0.55 },
  mapCard: {
    width: "100%",
    height: 160,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.xl,
    marginTop: Space.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  mapTitle: {
    position: "absolute",
    top: Space.sm,
    left: Space.sm,
    zIndex: 2,
    ...Typography.overline,
    color: BrandColors.textLight,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  map: { width: "100%", height: "100%" },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", gap: Space.sm },
  mapPlaceholderText: { color: BrandColors.textMuted, fontWeight: "600", fontSize: 13 },
});

