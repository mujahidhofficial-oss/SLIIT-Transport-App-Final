import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";

/** Demo “other drivers” amounts for comparison only — real offers use Trip action → Send offer. */
const DEMO_BIDS = [
  { label: "Driver A", amount: "1,200" },
  { label: "Driver B", amount: "950" },
  { label: "Driver C", amount: "1,100" },
];

export default function DriverSubmitBidsScreen() {
  const params = useLocalSearchParams<{ estimate?: string; requestId?: string }>();
  const routeEstimate = useMemo(() => {
    const n = Math.round(Number(String(params.estimate ?? "").replace(/,/g, "")));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params.estimate]);

  const [submitBid, setSubmitBid] = useState("");

  const onSubmit = () => {
    const value = submitBid.trim().replace(/,/g, "");
    if (!value) {
      Alert.alert("Missing amount", "Enter your bid in LKR, or go back to Trip action to send a real offer.");
      return;
    }
    Alert.alert(
      "Demo only",
      `You entered LKR ${value}. To send a fare the passenger can see, use Trip action → “Send offer” on a loaded request.`
    );
    setSubmitBid("");
  };

  return (
    <ScreenShell>
      <ScreenHeader
        showBack
        title="Compare bids"
        subtitle="Sample amounts for layout — your live offer is sent from Trip action."
      />

      <View style={styles.inner}>
        {routeEstimate != null ? (
          <AppCard style={styles.summaryCard} padded>
            <View style={styles.summaryRow}>
              <Ionicons name="navigate-outline" size={18} color={BrandColors.primaryDark} />
              <Text style={styles.summaryText}>
                Request estimate (from trip):{" "}
                <Text style={styles.summaryStrong}>LKR {routeEstimate.toLocaleString("en-LK")}</Text>
              </Text>
            </View>
            {params.requestId ? (
              <Text style={styles.summarySub} numberOfLines={2}>
                Request #{String(params.requestId).slice(-8)}… — send your fare from Trip action.
              </Text>
            ) : null}
          </AppCard>
        ) : null}

        <AppCard style={styles.card} padded>
          <Text style={styles.sectionTitle}>Try a number (demo)</Text>
          <Text style={styles.lead}>
            This screen is for comparing UI only. Passengers never see numbers from here.
          </Text>

          <View style={styles.submitRow}>
            <TextInput
              style={styles.topInput}
              placeholder="LKR"
              placeholderTextColor={BrandColors.textLight}
              keyboardType="numeric"
              value={submitBid}
              onChangeText={setSubmitBid}
            />
            <TouchableOpacity style={styles.submitButton} onPress={onSubmit} activeOpacity={0.88}>
              <Ionicons name="paper-plane-outline" size={16} color={BrandColors.white} />
              <Text style={styles.submitButtonText}>Try</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subTitle}>Other drivers (demo placeholders)</Text>
          {DEMO_BIDS.map((row) => (
            <View key={row.label} style={styles.bidRow}>
              <Text style={styles.bidLabel}>{row.label}</Text>
              <Text style={styles.bidValue}>LKR {row.amount}</Text>
            </View>
          ))}

          <PrimaryButton
            title="Back to Trip action"
            variant="outline"
            onPress={() => router.push("/driver-trip-action")}
            style={{ marginTop: Space.lg }}
          />
        </AppCard>
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
    backgroundColor: ScreenBg.light,
  },
  summaryCard: {
    marginBottom: Space.md,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.lg,
  },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: Space.sm },
  summaryText: { flex: 1, ...Typography.subhead, color: BrandColors.textDark, lineHeight: 20 },
  summaryStrong: { fontWeight: "900", color: BrandColors.primaryDark },
  summarySub: { marginTop: Space.sm, ...Typography.caption, color: BrandColors.textMuted },
  card: {
    width: "100%",
    backgroundColor: BrandColors.white,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.55)",
    ...Elevated.soft,
  },
  sectionTitle: { ...Typography.overline, color: BrandColors.textMuted, marginBottom: Space.xs },
  lead: { ...Typography.caption, color: BrandColors.textMuted, lineHeight: 18, marginBottom: Space.md },
  submitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    marginBottom: Space.lg,
  },
  topInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: Space.md,
    fontSize: 15,
    color: BrandColors.textDark,
    fontWeight: "700",
  },
  submitButton: {
    minWidth: 100,
    minHeight: 48,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.primaryDark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: { color: BrandColors.white, fontSize: 14, fontWeight: "800" },
  subTitle: { ...Typography.caption, color: BrandColors.textDark, fontWeight: "800", marginBottom: Space.md },
  bidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.border,
  },
  bidLabel: { fontSize: 13, color: BrandColors.textMuted, fontWeight: "700" },
  bidValue: { fontSize: 14, fontWeight: "800", color: BrandColors.primaryDark },
});
