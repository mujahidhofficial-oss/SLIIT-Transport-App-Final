import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

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
  const [viewerDriverId, setViewerDriverId] = useState("");
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerFeedback, setViewerFeedback] = useState<
    Array<{ _id: string; rating: number; comment?: string; createdAt?: string }>
  >([]);
  const [viewerAverage, setViewerAverage] = useState(0);
  const [viewerTotal, setViewerTotal] = useState(0);

  const canSubmit = useMemo(() => !!rideRequestId && !!driverId && rating >= 1, [rideRequestId, driverId, rating]);
  const isPassengerFeedbackMode = !!rideRequestId && !!driverId;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const session = await getAuthSession();
        if (!alive) return;
        const role = String(session?.user?.role ?? "").toLowerCase();
        const fallbackDriverId = String(session?.user?.id ?? "").trim();
        const did = driverId || fallbackDriverId;
        if (role !== "driver" || isPassengerFeedbackMode || !did) {
          setViewerLoading(false);
          return;
        }
        setViewerDriverId(did);
        setViewerLoading(true);
        try {
          const res = await fetch(`${getApiBaseUrl()}/api/feedback/driver/${encodeURIComponent(did)}`);
          const body = (await res.json().catch(() => ({}))) as {
            averageRating?: number;
            totalReviews?: number;
            feedback?: Array<{ _id: string; rating: number; comment?: string; createdAt?: string }>;
            message?: string;
          };
          if (!res.ok) throw new Error(body.message ?? "Failed to load feedback");
          if (!alive) return;
          setViewerAverage(Number(body.averageRating ?? 0));
          setViewerTotal(Number(body.totalReviews ?? 0));
          setViewerFeedback(Array.isArray(body.feedback) ? body.feedback : []);
        } catch (e) {
          if (!alive) return;
          Alert.alert("Feedback", e instanceof Error ? e.message : "Unable to load feedback");
        } finally {
          if (alive) setViewerLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [driverId, isPassengerFeedbackMode])
  );

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
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Feedback failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isPassengerFeedbackMode) {
    return (
      <ScreenShell>
        <ScreenHeader title="Driver Feedback" subtitle="See what passengers say about your trips" />
        <AppCard style={styles.card} padded>
          <Text style={styles.driverText}>
            Driver ID: <Text style={styles.driverValue}>{viewerDriverId || "—"}</Text>
          </Text>
          {viewerLoading ? (
            <Text style={styles.emptyText}>Loading feedback...</Text>
          ) : (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLabel}>Average rating</Text>
                  <Text style={styles.summaryValue}>{viewerAverage.toFixed(1)} / 5</Text>
                </View>
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryLabel}>Total reviews</Text>
                  <Text style={styles.summaryValue}>{viewerTotal}</Text>
                </View>
              </View>
              {viewerFeedback.length === 0 ? (
                <Text style={styles.emptyText}>No feedback yet.</Text>
              ) : (
                <View style={styles.feedbackList}>
                  {viewerFeedback.slice(0, 10).map((item) => (
                    <View key={item._id} style={styles.feedbackRow}>
                      <Text style={styles.feedbackRating}>{"★".repeat(Math.max(1, Math.min(5, Math.round(item.rating))))}</Text>
                      <Text style={styles.feedbackComment}>{item.comment?.trim() || "No comment provided."}</Text>
                      <Text style={styles.feedbackDate}>
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                          : ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </AppCard>
      </ScreenShell>
    );
  }

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
  summaryRow: { flexDirection: "row", gap: Space.sm, marginTop: Space.sm },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    padding: Space.sm,
    backgroundColor: BrandColors.surface,
  },
  summaryLabel: { fontSize: 11, fontWeight: "700", color: BrandColors.textMuted, textTransform: "uppercase" },
  summaryValue: { marginTop: 4, fontSize: 18, fontWeight: "900", color: BrandColors.primaryDark },
  emptyText: { marginTop: Space.md, ...Typography.subhead, color: BrandColors.textMuted },
  feedbackList: { marginTop: Space.md, gap: Space.sm },
  feedbackRow: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surface,
    padding: Space.sm,
  },
  feedbackRating: { fontSize: 14, color: "#F7B500", fontWeight: "800" },
  feedbackComment: { marginTop: 6, fontSize: 13, color: BrandColors.textDark, lineHeight: 19 },
  feedbackDate: { marginTop: 6, fontSize: 11, color: BrandColors.textMuted, fontWeight: "600" },
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
