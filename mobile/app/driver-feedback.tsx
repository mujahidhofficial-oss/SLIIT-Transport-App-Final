import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space, Typography } from "@/app/_theme/tokens";

export default function DriverFeedbackScreen() {
  const params = useLocalSearchParams<{
    rideRequestId?: string;
    driverId?: string;
    driverName?: string;
  }>();

  const rideRequestId = String(params.rideRequestId ?? "").trim();
  const driverId = String(params.driverId ?? "").trim();
  const driverName = String(params.driverName ?? "").trim();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => !!rideRequestId && !!driverId && rating >= 1, [rideRequestId, driverId, rating]);

  const onSubmit = async () => {
    if (submitting) return;
    if (!canSubmit) {
      Alert.alert("Missing details", "Please select a rating before submitting.");
      return;
    }
    const session = await getAuthSession();
    const passengerId = String(session?.user?.id ?? "").trim();
    if (!passengerId) {
      Alert.alert("Session expired", "Please log in again and retry.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${getApiBaseUrl()}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideRequestId,
          driverId,
          passengerId,
          rating,
          comment: comment.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to save feedback");

      Alert.alert("Thanks!", "Your feedback was submitted.");
      router.replace("/trip-history");
    } catch (e) {
      Alert.alert("Feedback failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Driver Feedback" subtitle="Rate your recent trip" />
      <AppCard style={styles.card} padded>
        <Text style={styles.driverText}>
          Driver: <Text style={styles.driverValue}>{driverName || "Assigned driver"}</Text>
        </Text>

        <Text style={styles.label}>Your rating</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} style={styles.starBtn}>
              <Ionicons
                name={n <= rating ? "star" : "star-outline"}
                size={30}
                color={n <= rating ? "#F7B500" : BrandColors.textLight}
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Comment (optional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={4}
          maxLength={500}
          style={styles.input}
          placeholder="Write your feedback..."
          placeholderTextColor={BrandColors.textLight}
        />

        <PrimaryButton
          title={submitting ? "Submitting..." : "Submit feedback"}
          onPress={() => void onSubmit()}
          disabled={!canSubmit || submitting}
          style={{ marginTop: Space.md }}
        />
      </AppCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Space.md },
  driverText: { ...Typography.body, color: BrandColors.textMuted, marginBottom: Space.sm },
  driverValue: { color: BrandColors.textDark, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "700", color: BrandColors.textDark, marginTop: Space.sm, marginBottom: 8 },
  starsRow: { flexDirection: "row", alignItems: "center", marginBottom: Space.sm },
  starBtn: { paddingRight: 6, paddingVertical: 4 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    color: BrandColors.textDark,
    backgroundColor: BrandColors.white,
  },
});
