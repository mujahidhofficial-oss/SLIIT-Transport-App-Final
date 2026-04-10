// This screen is for drivers to view and manage booking requests for a specific trip. It's not linked from the main app flow, but can be used for testing and demonstration purposes. Drivers can paste a trip ID, load pending booking requests, and accept or decline them.
import React, { useState } from "react";
import { Alert, FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";

type BookingItem = {
  _id: string;
  customerId: string;
  seatsRequested: number;
  status: "pending" | "accepted" | "declined" | "paid";
};

export default function DriverBookingRequests() {
  const insets = useSafeAreaInsets();
  const [tripId, setTripId] = useState("");
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRequests = async () => {
    const id = tripId.trim();
    if (!id) {
      Alert.alert("Trip ID", "Paste the trip ID you want to manage.");
      return;
    }
    try {
      setLoading(true);
      console.log("DriverBookingRequests.loadRequests tripId =", id);
      const res = await fetch(`${getApiBaseUrl()}/api/bookings/trip/${encodeURIComponent(id)}`);
      const data = (await res.json().catch(() => [])) as BookingItem[] | { message?: string };
      console.log("DriverBookingRequests.loadRequests status =", res.status, "data =", data);
      if (!res.ok) {
        const msg = (data as any)?.message || `Failed to load booking requests (${res.status})`;
        throw new Error(msg);
      }
      if (Array.isArray(data)) {
        setBookings(data);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.log("DriverBookingRequests.loadRequests ERROR =", error);
      const message = error instanceof Error ? error.message : "Failed to load requests";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const respond = async (bookingId: string, action: "accepted" | "declined") => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/bookings/${bookingId}/respond`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to update booking");
      await loadRequests();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to respond";
      Alert.alert("Error", message);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + Space.sm }]}>
      <View style={styles.top}>
        <ScreenHeader
          showBack
          title="Booking requests"
          subtitle="Enter a trip ID, load requests, then accept or decline."
        />
        <AppCard style={{ marginTop: Space.lg }}>
          <FormTextInput
            label="Trip ID"
            placeholder="MongoDB trip _id"
            value={tripId}
            onChangeText={setTripId}
            autoCapitalize="none"
            containerStyle={{ marginBottom: Space.sm }}
          />
          <PrimaryButton title={loading ? "Loading…" : "Load requests"} onPress={loadRequests} />
        </AppCard>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item._id}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        renderItem={({ item }) => (
          <AppCard style={styles.rowCard}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, statusBadgeStyle(item.status)]}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
            <Text style={styles.line}>Customer · {item.customerId}</Text>
            <Text style={styles.line}>Seats · {item.seatsRequested}</Text>
            {item.status === "pending" && (
              <View style={styles.actions}>
                <PrimaryButton title="Accept" onPress={() => respond(item._id, "accepted")} style={{ flex: 1 }} />
                <PrimaryButton
                  title="Decline"
                  variant="outline"
                  onPress={() => respond(item._id, "declined")}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </AppCard>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No requests loaded yet. Enter a trip ID and tap Load.</Text>
        }
      />
    </View>
  );
}

function statusBadgeStyle(status: BookingItem["status"]) {
  switch (status) {
    case "pending":
      return { backgroundColor: "#FFF8E6" };
    case "accepted":
      return { backgroundColor: BrandColors.accentSoft };
    case "declined":
      return { backgroundColor: "#F5F5F5" };
    case "paid":
      return { backgroundColor: "#E8F8EE" };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ScreenBg.light },
  top: {
    paddingBottom: Space.sm,
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
  rowCard: { marginBottom: Space.md },
  badgeRow: { marginBottom: Space.sm },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.pill,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: BrandColors.textDark, textTransform: "uppercase" },
  line: { fontSize: 14, color: BrandColors.textDark, marginTop: 4 },
  actions: { flexDirection: "row", gap: Space.sm, marginTop: Space.md },
  empty: {
    textAlign: "center",
    marginTop: Space.xl,
    color: BrandColors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
