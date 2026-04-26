import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space, Typography } from "@/app/_theme/tokens";
import { clearActiveRideRequest } from "@/app/_state/rideRequestStore";

export default function PaymentSuccessScreen() {
  const params = useLocalSearchParams<{
    paymentId?: string;
    ref?: string;
    total?: string;
    method?: string;
    requestId?: string;
    driverId?: string;
  }>();
  const referenceCode = params.ref ?? "REF-000000-000";
  const total = params.total ?? "0.00";
  const method = params.method ?? "card";
  const requestId = String(params.requestId ?? "").trim();
  const driverId = String(params.driverId ?? "").trim();
  const canLeaveFeedback = !!requestId && !!driverId;

  const title = useMemo(() => {
    if (method === "cash") return "Successfully Process";
    return "Successfully Process";
  }, [method]);

  useEffect(() => {
    clearActiveRideRequest();
  }, []);

  const subMsg = useMemo(() => {
    if (method === "bank") {
      return "Bank transfer recorded. Your file submission was received.";
    }
    if (method === "cash") {
      return "Cash payment recorded successfully.";
    }
    return "Card payment confirmed. Thank you — no slip upload needed.";
  }, [method]);

  return (
    <ScreenShell contentContainerStyle={{ justifyContent: "flex-start" }}>
      <ScreenHeader title={title} subtitle={`Reference ${referenceCode}`} showBack={false} />

      <View style={styles.topRow}>
        <ProfileAvatar size={46} />
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle-outline" size={18} color={BrandColors.success} />
          <Text style={styles.badgeText}>{total}</Text>
        </View>
      </View>

      <AppCard style={styles.centerCard} padded>
        <View style={styles.checkWrap}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={32} color={BrandColors.white} />
          </View>
          <Text style={styles.msg}>Payment completed successfully</Text>
          <Text style={styles.subMsg}>{subMsg}</Text>
        </View>

        <PrimaryButton
          title="Return to the home page"
          onPress={() => {
            clearActiveRideRequest();
            router.replace("/(tabs)");
          }}
          style={{ marginTop: Space.lg }}
        />
        {canLeaveFeedback ? (
          <PrimaryButton
            title="Rate this driver"
            variant="outline"
            onPress={() =>
              router.push({
                pathname: "/driver-feedback",
                params: {
                  rideRequestId: requestId,
                  driverId,
                },
              })
            }
            style={{ marginTop: Space.sm }}
          />
        ) : null}
      </AppCard>

      <Pressable
        style={styles.fab}
        onPress={() => router.replace({ pathname: "/order-processing" })}
        accessibilityRole="button"
        accessibilityLabel="Start another payment"
      >
        <Ionicons name="refresh" size={18} color={BrandColors.white} />
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topRow: {
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: "rgba(13, 177, 75, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(13, 177, 75, 0.22)",
  },
  badgeText: { fontSize: 13, fontWeight: "900", color: BrandColors.primaryDark },

  centerCard: { marginTop: 64 },
  checkWrap: { alignItems: "center" },
  checkCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.md,
  },
  msg: { ...Typography.headline, color: BrandColors.textDark, textAlign: "center" },
  subMsg: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

