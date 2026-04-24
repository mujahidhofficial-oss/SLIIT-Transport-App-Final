import React, { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { ScreenFixed } from "@/app/_components/ui/ScreenShell";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { getDriverSession } from "@/app/_state/driverSession";

type PendingRideRequest = {
  id: string;
  customerId: string;
  pickup: { address: string; lat: number; lng: number };
  dropoff: { address: string; lat: number; lng: number };
  distanceKm: number;
  estimatedFareLkr: number;
  vehicleType?: "car" | "bike" | "van" | "tuk_tuk";
  seatCount?: number;
  status: "pending";
  createdAt?: string;
};

export default function DriverRideRequestsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PendingRideRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/pending`);
      const data = (await res.json().catch(() => [])) as PendingRideRequest[] | { message?: string };
      if (!res.ok) throw new Error((data as any)?.message || "Failed to load requests");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const respond = async (requestId: string, action: "accepted" | "declined") => {
    try {
      const sess = await getDriverSession();
      const driverId = sess?.driverId ?? "";
      const auth = await getAuthSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
      const res = await fetch(`${getApiBaseUrl()}/api/ride-requests/${requestId}/respond`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ action, driverId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to update request");
      await load();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to respond");
    }
  };

  return (
    <ScreenFixed style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        ListHeaderComponent={
          <View style={[styles.top, { paddingTop: insets.top + Space.sm }]}>
            <ScreenHeader
              showBack
              title="Ride requests (nearby)"
              subtitle="Accept or decline customer requests (on-demand)."
            />
            <View style={{ marginTop: Space.md }}>
              <PrimaryButton title={loading ? "Loading…" : "Refresh"} onPress={() => void load()} />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <AppCard style={styles.card} padded>
            <Text style={styles.route} numberOfLines={2}>
              {item.pickup.address || "Pickup"} → {item.dropoff.address || "Drop"}
            </Text>
            <Text style={styles.meta}>
              ~{item.distanceKm.toFixed(1)} km · Est. fare LKR {Math.round(item.estimatedFareLkr).toLocaleString("en-LK")}
            </Text>
            <Text style={styles.metaSmall}>
              Vehicle · {String(item.vehicleType ?? "car").replace("_", " ")} · Seats {Math.max(1, Number(item.seatCount) || 1)}
            </Text>
            <Text style={styles.metaSmall}>Customer · {item.customerId}</Text>

            <View style={styles.actions}>
              <PrimaryButton title="Accept" onPress={() => void respond(item.id, "accepted")} style={{ flex: 1 }} />
              <PrimaryButton
                title="Decline"
                variant="outline"
                onPress={() => void respond(item.id, "declined")}
                style={{ flex: 1 }}
              />
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No pending ride requests right now. Pull refresh or wait for a customer request.</Text>
        }
      />
    </ScreenFixed>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ScreenBg.light, paddingHorizontal: 0 },
  top: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  list: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.md,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
    flexGrow: 1,
  },
  card: { marginBottom: Space.md, borderRadius: Radii.lg },
  route: { fontSize: 15, fontWeight: "900", color: BrandColors.primaryDark },
  meta: { marginTop: 6, fontSize: 13, color: BrandColors.textDark, fontWeight: "700" },
  metaSmall: { marginTop: 4, fontSize: 12, color: BrandColors.textMuted, fontWeight: "600" },
  actions: { flexDirection: "row", gap: Space.sm, marginTop: Space.md },
  empty: {
    textAlign: "center",
    marginTop: Space.xl,
    color: BrandColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
});

