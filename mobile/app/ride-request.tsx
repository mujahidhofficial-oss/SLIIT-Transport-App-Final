import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { MapView, Marker, Polyline } from "./_components/maps/MapPrimitives";
import {
  createRideRequest,
  useRideRequestStore,
  clearActiveRideRequest,
  getActiveRideRequest,
  mergeActiveRideRequest,
  sendPassengerBidResponse,
} from "@/app/_state/rideRequestStore";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

const VEHICLE_OPTIONS = [
  { id: "car", label: "Car", seats: 3, base: 160, perKm: 90 },
  { id: "bike", label: "Bike", seats: 1, base: 100, perKm: 60 },
  { id: "van", label: "Van", seats: 5, base: 220, perKm: 110 },
  { id: "tuk_tuk", label: "Tuk Tuk", seats: 2, base: 130, perKm: 75 },
] as const;
type VehicleId = (typeof VEHICLE_OPTIONS)[number]["id"];

function isPeakTime(now = new Date()) {
  const h = now.getHours();
  return (h >= 7 && h < 10) || (h >= 17 && h < 20);
}

function estimateFareByVehicle(distanceKm: number, vehicleType: VehicleId, seatCount: number) {
  const cfg = VEHICLE_OPTIONS.find((v) => v.id === vehicleType) ?? VEHICLE_OPTIONS[0];
  const seats = Math.max(1, Math.min(cfg.seats, Math.round(seatCount || 1)));
  const km = Math.max(0, distanceKm);
  const peakOffPeakMultiplier = isPeakTime() ? 1.25 : 0.9;
  return Math.round((cfg.base + km * cfg.perKm) * peakOffPeakMultiplier * seats);
}

export default function RideRequestScreen() {
  const insets = useSafeAreaInsets();
  const { activeRequest } = useRideRequestStore();
  const [pickupLabel, setPickupLabel] = useState("Current location");
  const [pickupText, setPickupText] = useState("");
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropText, setDropText] = useState("");
  const [drop, setDrop] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleId>("car");
  const [seatCount, setSeatCount] = useState(1);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [loadingReq, setLoadingReq] = useState(false);
  const [driverProgress, setDriverProgress] = useState(0.12);
  const [paymentRedirectDone, setPaymentRedirectDone] = useState(false);
  const [bidResponseBusy, setBidResponseBusy] = useState<null | "accepted" | "declined">(null);

  const distanceKm = useMemo(() => {
    if (!pickup || !drop) return 0;
    return haversineKm(pickup, drop);
  }, [pickup, drop]);

  const maxSeatsForVehicle = useMemo(
    () => VEHICLE_OPTIONS.find((v) => v.id === vehicleType)?.seats ?? 1,
    [vehicleType]
  );
  useEffect(() => {
    setSeatCount((prev) => Math.max(1, Math.min(maxSeatsForVehicle, prev)));
  }, [maxSeatsForVehicle]);
  const fare = useMemo(
    () => estimateFareByVehicle(distanceKm, vehicleType, seatCount),
    [distanceKm, vehicleType, seatCount]
  );
  const acceptedPickup = activeRequest?.pickup;
  const acceptedDrop = activeRequest?.dropoff;

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const r = getActiveRideRequest();
        if (!r || (r.status !== "pending" && r.status !== "accepted")) return;
        const session = await getAuthSession();
        const cid = session?.user?.id;
        if (!cid) return;
        try {
          const res = await fetch(
            `${getApiBaseUrl()}/api/ride-requests/${encodeURIComponent(r.id)}?customerId=${encodeURIComponent(cid)}`
          );
          const j = (await res.json().catch(() => ({}))) as {
            driverBidLkr?: number;
            driverBidDriverName?: string;
            driverBidDriverId?: string;
            passengerBidResponse?: string;
            driverAtPickup?: boolean;
            driverAtPickupAt?: string;
          };
          if (!res.ok) return;
          const bid = Math.round(Number(j.driverBidLkr));
          const pbr = String(j.passengerBidResponse ?? "").toLowerCase();
          const passengerBidResponse =
            pbr === "accepted" || pbr === "declined" ? pbr : ("none" as const);
          mergeActiveRideRequest({
            ...(bid > 0
              ? {
                  driverBidLkr: bid,
                  driverBidDriverName: j.driverBidDriverName ? String(j.driverBidDriverName) : undefined,
                  driverBidDriverId: j.driverBidDriverId ? String(j.driverBidDriverId) : undefined,
                }
              : {}),
            passengerBidResponse,
            driverAtPickup: !!j.driverAtPickup,
            driverAtPickupAt: j.driverAtPickupAt ? String(j.driverAtPickupAt) : undefined,
          });
        } catch {
          /* ignore */
        }
      })();
    }, [activeRequest?.id, activeRequest?.status])
  );

  useEffect(() => {
    if (activeRequest?.status !== "accepted") {
      setDriverProgress(0.12);
      return;
    }
    const t = setInterval(() => {
      setDriverProgress((p) => (p >= 0.94 ? 0.94 : Math.min(0.94, p + 0.06)));
    }, 2200);
    return () => clearInterval(t);
  }, [activeRequest?.status, activeRequest?.id]);

  useEffect(() => {
    if (activeRequest?.status !== "completed") {
      setPaymentRedirectDone(false);
      return;
    }
    if (paymentRedirectDone) return;
    setPaymentRedirectDone(true);
    Alert.alert(
      "Trip completed",
      "Pay for this ride, or skip to book a new driver.",
      [
        {
          text: "Pay now",
          onPress: () =>
            void (async () => {
              const assignedId = activeRequest.driver?.id ? String(activeRequest.driver.id) : "";
              let amountLkr = Math.max(0, Math.round(activeRequest.estimatedFareLkr || 0));
              let tipDescription = "Driver completed trip";

              try {
                const auth = await getAuthSession();
                const customerId = auth?.user?.id ? String(auth.user.id) : "";
                if (customerId) {
                  const res = await fetch(
                    `${getApiBaseUrl()}/api/ride-requests/${encodeURIComponent(activeRequest.id)}?customerId=${encodeURIComponent(
                      customerId
                    )}`
                  );
                  const j = (await res.json().catch(() => ({}))) as { fareToPayLkr?: number };
                  if (res.ok) {
                    const ftp = Math.round(Number(j?.fareToPayLkr));
                    if (Number.isFinite(ftp) && ftp > 0) {
                      amountLkr = ftp;
                      tipDescription = "Final fare (incl. accepted offer if any)";
                    }
                  }
                }
              } catch {
                /* ignore; fallback to local estimate */
              }

              router.push({
                pathname: "/order-processing",
                params: {
                  requestId: activeRequest.id,
                  tripDescription: `${activeRequest.pickup.address || "Pickup"} → ${activeRequest.dropoff.address || "Drop"}`,
                  tipDescription,
                  basicClassification: "Ride Fare",
                  subcategory: "On-demand",
                  amount: String(amountLkr),
                  adminFee: "0",
                  driverId: assignedId,
                },
              });
            })(),
        },
        {
          text: "Skip — new ride",
          style: "cancel",
          onPress: () => {
            setPaymentRedirectDone(false);
            clearActiveRideRequest();
          },
        },
      ],
      { cancelable: true }
    );
  }, [activeRequest, paymentRedirectDone]);

  const liveDriverPoint = useMemo(() => {
    if (!acceptedPickup || !acceptedDrop) return null;
    const lat = acceptedPickup.lat + (acceptedDrop.lat - acceptedPickup.lat) * driverProgress;
    const lng = acceptedPickup.lng + (acceptedDrop.lng - acceptedPickup.lng) * driverProgress;
    return { lat, lng };
  }, [acceptedPickup, acceptedDrop, driverProgress]);
  const liveEtaMin = useMemo(() => {
    const km = Math.max(0, Number(activeRequest?.distanceKm ?? distanceKm) || 0);
    return Math.max(3, Math.round(4 + km * 2.2));
  }, [activeRequest?.distanceKm, distanceKm]);

  const onPassengerBidResponse = useCallback(async (response: "accepted" | "declined") => {
    const r = getActiveRideRequest();
    if (!r?.id || r.status !== "pending") return;
    try {
      setBidResponseBusy(response);
      await sendPassengerBidResponse(r.id, response);
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again");
    } finally {
      setBidResponseBusy(null);
    }
  }, []);

  const fetchCurrentLocation = async () => {
    if (loadingLoc) return;
    try {
      setLoadingLoc(true);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location", "Permission denied. Enable location to use current position.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPickup({ lat, lng });

      const rev = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
      const first = rev?.[0];
      const label = first
        ? [first.name, first.street, first.city, first.region].filter(Boolean).join(", ")
        : "Current location";
      setPickupLabel(label);
      setPickupText(label);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Unable to fetch location");
    } finally {
      setLoadingLoc(false);
    }
  };

  const geocodePickup = async () => {
    const q = pickupText.trim();
    if (!q) {
      setPickup(null);
      setPickupLabel("Current location");
      return;
    }
    try {
      setLoadingLoc(true);
      const res = await Location.geocodeAsync(q);
      const first = res?.[0];
      if (!first) {
        Alert.alert("Pickup", "Could not find that place. Try a more specific name.");
        return;
      }
      setPickup({ lat: first.latitude, lng: first.longitude });
      setPickupLabel(q);
    } catch {
      Alert.alert("Pickup", "Unable to search pickup on this device.");
    } finally {
      setLoadingLoc(false);
    }
  };

  const geocodeDestination = async () => {
    const q = dropText.trim();
    if (!q) {
      setDrop(null);
      return;
    }
    try {
      setLoadingLoc(true);
      const res = await Location.geocodeAsync(q);
      const first = res?.[0];
      if (!first) {
        Alert.alert("Destination", "Could not find that place. Try a more specific name.");
        setDrop(null);
        return;
      }
      setDrop({ lat: first.latitude, lng: first.longitude });
    } catch {
      Alert.alert("Destination", "Unable to search destination on this device.");
      setDrop(null);
    } finally {
      setLoadingLoc(false);
    }
  };

  const onRequestDriver = async () => {
    if (loadingReq) return;
    const live = getActiveRideRequest();
    if (live && (live.status === "pending" || live.status === "accepted")) {
      Alert.alert("Active ride", "You already have a ride waiting or in progress. Clear it first if you need to restart.");
      return;
    }
    if (live && (live.status === "completed" || live.status === "declined")) {
      clearActiveRideRequest();
    }
    if (!pickup) {
      Alert.alert("Pickup", "Set pickup with “Find pickup” or “Use my location”.");
      return;
    }
    if (!drop || dropText.trim().length < 2) {
      Alert.alert("Destination", "Enter a destination and tap “Find destination”.");
      return;
    }
    try {
      setLoadingReq(true);
      await createRideRequest({
        pickup: { address: pickupLabel, lat: pickup.lat, lng: pickup.lng },
        dropoff: { address: dropText.trim(), lat: drop.lat, lng: drop.lng },
        vehicleType,
        seatCount,
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to request driver");
    } finally {
      setLoadingReq(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader showBack title="Request a driver" subtitle="PickMe-style: current location → destination → request" />

      <ScrollView
        style={{ flex: 1, backgroundColor: ScreenBg.light }}
        contentContainerStyle={{
          paddingHorizontal: Layout.screenPaddingX - 2,
          paddingTop: Space.md,
          paddingBottom: Math.max(insets.bottom, 20) + 20,
          maxWidth: Layout.contentMaxWidth,
          alignSelf: "center",
          width: "100%",
        }}
      >
        <AppCard padded style={styles.card}>
          <Text style={styles.sectionLabel}>Pickup</Text>
          <FormTextInput
            label="Pickup location"
            placeholder="Type pickup place or use current location"
            value={pickupText}
            onChangeText={setPickupText}
            containerStyle={{ marginBottom: Space.sm }}
          />
          <View style={styles.pickupActionRow}>
            <PrimaryButton
              title={loadingLoc ? "Searching…" : "Find pickup"}
              onPress={() => void geocodePickup()}
              disabled={loadingLoc}
              variant="outline"
              style={styles.pickupActionBtn}
            />
            <PrimaryButton
              title={loadingLoc ? "Getting…" : "Use my location"}
              onPress={() => void fetchCurrentLocation()}
              style={styles.pickupActionBtn}
              disabled={loadingLoc}
            />
          </View>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Ionicons name="locate-outline" size={16} color={BrandColors.primaryDark} />
              <Text style={styles.pillText} numberOfLines={2}>
                {pickupLabel || "Current location"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Destination</Text>
          <FormTextInput
            label="Where to?"
            placeholder="e.g. SLIIT Malabe, Colombo Fort…"
            value={dropText}
            onChangeText={setDropText}
            containerStyle={{ marginBottom: Space.sm }}
          />
          <PrimaryButton
            title={loadingLoc ? "Searching…" : "Find destination"}
            onPress={() => void geocodeDestination()}
            disabled={loadingLoc}
            variant="outline"
          />

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Vehicle type</Text>
          <View style={styles.optionRow}>
            {VEHICLE_OPTIONS.map((v) => {
              const active = vehicleType === v.id;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => setVehicleType(v.id)}
                  style={[styles.optionChip, active && styles.optionChipActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {v.label} · {v.seats} seats
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: Space.sm }]}>Seat count</Text>
          <View style={styles.optionRow}>
            {Array.from({ length: maxSeatsForVehicle }, (_, i) => i + 1).map((s) => {
              const active = seatCount === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSeatCount(s)}
                  style={[styles.seatChip, active && styles.optionChipActive]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Estimate</Text>
          <View style={styles.estimateRow}>
            <View style={styles.estimateChip}>
              <Text style={styles.estimateLabel}>Distance</Text>
              <Text style={styles.estimateValue}>{distanceKm ? `${distanceKm.toFixed(1)} km` : "—"}</Text>
            </View>
            <View style={styles.estimateChip}>
              <Text style={styles.estimateLabel}>Est. fare</Text>
              <Text style={styles.estimateValue}>LKR {fare.toLocaleString("en-LK")}</Text>
            </View>
          </View>
          <Text style={styles.hintLine}>
            Fare changes by peak/off-peak time, distance, vehicle type, and seat count.
          </Text>

          {activeRequest ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusTitle}>
                {activeRequest.status === "pending"
                  ? "Waiting for a driver…"
                  : activeRequest.status === "accepted"
                  ? "Driver accepted"
                  : activeRequest.status === "declined"
                  ? "Declined"
                  : activeRequest.status === "completed"
                  ? "Trip completed"
                  : "Status updated"}
              </Text>
              <Text style={styles.statusSub}>
                {activeRequest.status === "pending"
                  ? "Your request was sent to nearby drivers. You’ll see updates here."
                  : activeRequest.status === "accepted"
                  ? `Driver is on the way.${activeRequest.driver?.name ? ` (${activeRequest.driver?.name})` : ""}`
                  : activeRequest.status === "declined"
                  ? "No driver accepted yet. Use the button below to try again."
                  : activeRequest.status === "completed"
                  ? "Trip finished. Pay when ready, or start a new ride below."
                  : "—"}
              </Text>

              {activeRequest.status === "pending" &&
              activeRequest.driverBidLkr != null &&
              activeRequest.driverBidLkr > 0 ? (
                <View style={styles.bidBanner} accessibilityRole="summary">
                  <View style={styles.bidBannerHeader}>
                    <Ionicons name="pricetag" size={18} color={BrandColors.primaryDark} />
                    <Text style={styles.bidBannerTitle}>Driver’s offer</Text>
                  </View>
                  <Text style={styles.bidBannerAmount}>
                    LKR {activeRequest.driverBidLkr.toLocaleString("en-LK")}
                  </Text>
                  {activeRequest.driverBidDriverName ? (
                    <Text style={styles.bidBannerSub}>
                      From {activeRequest.driverBidDriverName} — you can still wait for them to accept, or clear and request again.
                    </Text>
                  ) : (
                    <Text style={styles.bidBannerSub}>
                      A driver shared this fare — shown above the app estimate while the request is open.
                    </Text>
                  )}
                  <View style={styles.bidCompareRow}>
                    <View style={styles.bidCompareCol}>
                      <Text style={styles.bidCompareLabel}>App estimate</Text>
                      <Text style={styles.bidCompareValue}>LKR {activeRequest.estimatedFareLkr.toLocaleString("en-LK")}</Text>
                    </View>
                    <View style={styles.bidCompareCol}>
                      <Text style={styles.bidCompareLabel}>Driver offer</Text>
                      <Text style={[styles.bidCompareValue, styles.bidCompareHighlight]}>
                        LKR {activeRequest.driverBidLkr.toLocaleString("en-LK")}
                      </Text>
                    </View>
                  </View>

                  {activeRequest.passengerBidResponse === "accepted" ? (
                    <View style={styles.bidStatusOk}>
                      <Ionicons name="checkmark-circle" size={18} color={BrandColors.success} />
                      <Text style={styles.bidStatusOkText}>You told the driver you’re OK with this fare.</Text>
                    </View>
                  ) : activeRequest.passengerBidResponse === "declined" ? (
                    <View style={styles.bidStatusNo}>
                      <Text style={styles.bidStatusNoText}>
                        You’re not interested in this offer — the driver can see that.
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.bidActionRow}>
                    <Pressable
                      style={[styles.bidOkBtn, !!bidResponseBusy && styles.bidBtnDisabled]}
                      disabled={!!bidResponseBusy}
                      onPress={() => void onPassengerBidResponse("accepted")}
                      accessibilityRole="button"
                      accessibilityLabel="Accept driver fare offer"
                    >
                      <Text style={styles.bidOkBtnText}>
                        {bidResponseBusy === "accepted" ? "Saving…" : "OK — I’m good with this fare"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.bidDeclineBtn, !!bidResponseBusy && styles.bidBtnDisabled]}
                      disabled={!!bidResponseBusy}
                      onPress={() => void onPassengerBidResponse("declined")}
                      accessibilityRole="button"
                      accessibilityLabel="Decline driver fare offer"
                    >
                      <Text style={styles.bidDeclineBtnText}>
                        {bidResponseBusy === "declined" ? "Saving…" : "Not interested"}
                      </Text>
                    </Pressable>
                  </View>

                  {activeRequest.passengerBidResponse === "accepted" &&
                  activeRequest.driverBidDriverId &&
                  activeRequest.driverBidLkr != null &&
                  activeRequest.driverBidLkr > 0 ? (
                    <PrimaryButton
                      title={`Pay this fare (LKR ${activeRequest.driverBidLkr.toLocaleString("en-LK")})`}
                      onPress={() =>
                        router.push({
                          pathname: "/order-processing",
                          params: {
                            requestId: activeRequest.id,
                            driverId: activeRequest.driverBidDriverId,
                            tripDescription: `${activeRequest.pickup.address || "Pickup"} → ${activeRequest.dropoff.address || "Drop"}`,
                            tipDescription: "Agreed driver offer",
                            basicClassification: "Ride Fare",
                            subcategory: "On-demand",
                            amount: String(Math.max(1, Math.round(activeRequest.driverBidLkr ?? 0))),
                            adminFee: "0",
                          },
                        })
                      }
                      style={{ marginTop: Space.md }}
                    />
                  ) : null}
                </View>
              ) : null}

              {activeRequest.status === "accepted" && activeRequest.driver ? (
                <View style={styles.driverCard}>
                  {activeRequest.driverAtPickup ? (
                    <View style={styles.arrivedPill}>
                      <Ionicons name="location" size={16} color={BrandColors.success} />
                      <Text style={styles.arrivedText}>
                        Driver has arrived at your pickup{activeRequest.driverAtPickupAt
                          ? ` · ${new Date(activeRequest.driverAtPickupAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.comingPill}>
                      <Ionicons name="car-sport-outline" size={14} color={BrandColors.primaryDark} />
                      <Text style={styles.comingText}>Driver is coming · ETA ~{liveEtaMin} min</Text>
                    </View>
                  )}
                  <View style={styles.progressRow}>
                    <View style={[styles.progressChip, styles.progressChipDone]}>
                      <Text style={styles.progressTextDone}>Requested</Text>
                    </View>
                    <View style={[styles.progressChip, styles.progressChipDone]}>
                      <Text style={styles.progressTextDone}>Accepted</Text>
                    </View>
                    <View style={[styles.progressChip, activeRequest.driverAtPickup && styles.progressChipDone]}>
                      <Text style={activeRequest.driverAtPickup ? styles.progressTextDone : styles.progressText}>
                        {activeRequest.driverAtPickup ? "At pickup" : "Driver coming"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.driverLine}>
                    Driver · {activeRequest.driver.name || activeRequest.driver.id || "—"}
                  </Text>
                  {activeRequest.driver.phone ? (
                    <Text style={styles.driverLine}>Contact · {activeRequest.driver.phone}</Text>
                  ) : null}
                  {activeRequest.driver.vehicleNumber ? (
                    <Text style={styles.driverLine}>Vehicle · {activeRequest.driver.vehicleNumber}</Text>
                  ) : null}
                  <Text style={styles.driverLine}>
                    Live location sharing · {activeRequest.driver.showLocation ? "On" : "Off"}
                  </Text>

                  {activeRequest.driver.showLocation &&
                  acceptedPickup &&
                  acceptedDrop &&
                  liveDriverPoint &&
                  MapView &&
                  Marker &&
                  Polyline ? (
                    <View style={styles.mapWrap}>
                      <Text style={styles.miniMapTitle}>Live mini map</Text>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: acceptedPickup.lat,
                          longitude: acceptedPickup.lng,
                          latitudeDelta: Math.max(0.03, Math.abs(acceptedPickup.lat - acceptedDrop.lat) * 1.8),
                          longitudeDelta: Math.max(0.03, Math.abs(acceptedPickup.lng - acceptedDrop.lng) * 1.8),
                        }}
                      >
                        <Marker
                          coordinate={{ latitude: acceptedPickup.lat, longitude: acceptedPickup.lng }}
                          title="Pickup"
                          pinColor="green"
                        />
                        <Marker
                          coordinate={{ latitude: acceptedDrop.lat, longitude: acceptedDrop.lng }}
                          title="Drop"
                          pinColor="red"
                        />
                        <Marker
                          coordinate={{ latitude: liveDriverPoint.lat, longitude: liveDriverPoint.lng }}
                          title="Driver coming"
                          description={`ETA ~${liveEtaMin} min`}
                        >
                          <View style={styles.driverPin}>
                            <Ionicons name="car-sport" size={14} color={BrandColors.white} />
                          </View>
                        </Marker>
                        <Polyline
                          coordinates={[
                            { latitude: acceptedPickup.lat, longitude: acceptedPickup.lng },
                            { latitude: acceptedDrop.lat, longitude: acceptedDrop.lng },
                          ]}
                          strokeColor={BrandColors.primary}
                          strokeWidth={3}
                        />
                      </MapView>
                    </View>
                  ) : activeRequest.driver.showLocation && acceptedPickup && acceptedDrop ? (
                    <View style={styles.mapWebHint}>
                      <Text style={styles.mapWebHintText}>Mini map is available on Android/iOS builds.</Text>
                    </View>
                  ) : (
                    <View style={styles.mapWebHint}>
                      <Text style={styles.mapWebHintText}>Driver has location sharing turned off.</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <Pressable onPress={() => clearActiveRideRequest()} style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            </View>
          ) : null}

          {!activeRequest || activeRequest.status === "completed" || activeRequest.status === "declined" ? (
            <PrimaryButton
              title={
                loadingReq
                  ? "Requesting…"
                  : activeRequest?.status === "completed" || activeRequest?.status === "declined"
                  ? "Request a new driver"
                  : "Request nearest driver"
              }
              onPress={() => void onRequestDriver()}
              style={{ marginTop: Space.md }}
              disabled={loadingReq}
            />
          ) : null}
        </AppCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Space.sm },
  sectionLabel: { ...Typography.overline, color: BrandColors.textMuted, marginBottom: Space.sm },
  pickupActionRow: { flexDirection: "row", gap: Space.sm, marginBottom: Space.sm },
  pickupActionBtn: { flex: 1 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  pill: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  pillText: { flex: 1, fontSize: 13, fontWeight: "700", color: BrandColors.textDark },
  divider: { height: 1, backgroundColor: BrandColors.surfaceMuted, marginVertical: Space.md },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: Space.sm },
  optionChip: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  seatChip: {
    minWidth: 44,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionChipActive: { borderColor: BrandColors.primary, backgroundColor: BrandColors.accentSoft },
  optionText: { fontSize: 12, fontWeight: "700", color: BrandColors.textDark },
  optionTextActive: { color: BrandColors.primaryDark },
  estimateRow: { flexDirection: "row", gap: Space.sm },
  estimateChip: {
    flex: 1,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Space.md,
  },
  estimateLabel: { fontSize: 11, fontWeight: "800", color: BrandColors.textMuted, textTransform: "uppercase" },
  estimateValue: { marginTop: 6, fontSize: 16, fontWeight: "900", color: BrandColors.primaryDark },
  hintLine: { marginTop: Space.sm, fontSize: 11, color: BrandColors.textMuted, lineHeight: 16 },
  statusBox: {
    marginTop: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.accentSoft,
    padding: Space.md,
  },
  statusTitle: { fontSize: 14, fontWeight: "900", color: BrandColors.primaryDark },
  statusSub: { marginTop: 6, fontSize: 12, fontWeight: "600", color: BrandColors.textDark, lineHeight: 18 },
  bidBanner: {
    marginTop: Space.md,
    padding: Space.md,
    borderRadius: Radii.lg,
    backgroundColor: BrandColors.white,
    borderWidth: 1.5,
    borderColor: BrandColors.primary,
  },
  bidBannerHeader: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginBottom: Space.xs },
  bidBannerTitle: { ...Typography.overline, color: BrandColors.primaryDark, letterSpacing: 0.5 },
  bidBannerAmount: { fontSize: 24, fontWeight: "900", color: BrandColors.primaryDark, letterSpacing: -0.5 },
  bidBannerSub: { marginTop: Space.sm, fontSize: 12, fontWeight: "600", color: BrandColors.textMuted, lineHeight: 18 },
  bidCompareRow: {
    flexDirection: "row",
    gap: Space.sm,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.surfaceMuted,
  },
  bidCompareCol: { flex: 1 },
  bidCompareLabel: { fontSize: 10, fontWeight: "800", color: BrandColors.textMuted, textTransform: "uppercase" },
  bidCompareValue: { marginTop: 4, fontSize: 15, fontWeight: "800", color: BrandColors.textDark },
  bidCompareHighlight: { color: BrandColors.primaryDark },
  bidStatusOk: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
    padding: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: "rgba(25,169,116,0.1)",
    borderWidth: 1,
    borderColor: "rgba(25,169,116,0.35)",
  },
  bidStatusOkText: { flex: 1, fontSize: 12, fontWeight: "700", color: BrandColors.success, lineHeight: 18 },
  bidStatusNo: {
    marginTop: Space.md,
    padding: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surfaceMuted,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  bidStatusNoText: { fontSize: 12, fontWeight: "600", color: BrandColors.textMuted, lineHeight: 18 },
  bidActionRow: { marginTop: Space.md, gap: Space.sm },
  bidOkBtn: {
    paddingVertical: 12,
    paddingHorizontal: Space.md,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
  },
  bidOkBtnText: { fontSize: 13, fontWeight: "800", color: BrandColors.white },
  bidDeclineBtn: {
    paddingVertical: 12,
    paddingHorizontal: Space.md,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surface,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    alignItems: "center",
  },
  bidDeclineBtnText: { fontSize: 13, fontWeight: "800", color: BrandColors.textDark },
  bidBtnDisabled: { opacity: 0.55 },
  driverCard: {
    marginTop: Space.sm,
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: Space.md,
  },
  comingPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: BrandColors.border,
    marginBottom: Space.sm,
  },
  arrivedPill: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    backgroundColor: "rgba(25,169,116,0.12)",
    borderWidth: 1,
    borderColor: "rgba(25,169,116,0.4)",
    marginBottom: Space.sm,
  },
  arrivedText: { flex: 1, fontSize: 13, fontWeight: "800", color: BrandColors.success, lineHeight: 18 },
  comingText: { fontSize: 12, fontWeight: "800", color: BrandColors.primaryDark },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  progressChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  progressChipDone: {
    backgroundColor: "rgba(25,169,116,0.12)",
    borderColor: "rgba(25,169,116,0.35)",
  },
  progressText: { fontSize: 11, fontWeight: "700", color: BrandColors.textMuted },
  progressTextDone: { fontSize: 11, fontWeight: "800", color: BrandColors.success },
  driverLine: { fontSize: 12, fontWeight: "700", color: BrandColors.textDark, marginTop: 4 },
  mapWrap: {
    marginTop: Space.sm,
    borderRadius: Radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  miniMapTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: BrandColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  map: {
    width: "100%",
    height: 120,
  },
  driverPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primaryDark,
    borderWidth: 1,
    borderColor: BrandColors.white,
  },
  mapWebHint: {
    marginTop: Space.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    padding: Space.md,
  },
  mapWebHintText: { fontSize: 12, fontWeight: "700", color: BrandColors.textMuted },
  clearBtn: { marginTop: Space.sm, alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 6 },
  clearText: { fontSize: 13, fontWeight: "800", color: BrandColors.primary, textDecorationLine: "underline" },
});

