import React, { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BrandColors } from "@/app/_theme/colors";
import { AppCard } from "@/app/_components/ui/AppCard";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { getDriverSession } from "@/app/_state/driverSession";
import { getApiBaseUrl } from "@/app/_state/api";

type DailyEarning = {
  date: string;
  dateLabel: string;
  totalLkr: number;
  tripCount: number;
  trips: {
    kind?: string;
    referenceCode?: string;
    tripDescription: string;
    fareLkr: number;
    method: string;
  }[];
};

type EarningsPayload = {
  driverId: string;
  todayLkr: number;
  totalLkr: number;
  todayKey: string;
  daily: DailyEarning[];
  note?: string;
};

type AnalyticsPayload = {
  revenue: number;
  occupancyRate: number;
  completedBookings: number;
  completedTrips: number;
};

export default function DriverEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<EarningsPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  const load = useCallback(async () => {
    const session = await getDriverSession();
    if (!session?.driverId) {
      setEarnings(null);
      setAnalytics(null);
      setLoading(false);
      return;
    }
    const base = getApiBaseUrl();
    const id = session.driverId;

    try {
      const [earnRes, anaRes] = await Promise.all([
        fetch(`${base}/api/drivers/${id}/earnings`),
        fetch(`${base}/api/bookings/driver/${id}/analytics`),
      ]);
      const earnBody = await earnRes.json().catch(() => ({}));
      const anaBody = await anaRes.json().catch(() => ({}));
      if (earnRes.ok) setEarnings(earnBody as EarningsPayload);
      else setEarnings(null);
      if (anaRes.ok) setAnalytics(anaBody as AnalyticsPayload);
      else setAnalytics(null);
    } catch {
      setEarnings(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  return (
    <ScreenShell>
      <ScreenHeader
        showBack
        title="Earnings"
        subtitle="Daily totals after passengers complete payment"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BrandColors.primaryDark}
            colors={[BrandColors.primaryDark]}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={BrandColors.primary} />
            <Text style={styles.muted}>Loading earnings…</Text>
          </View>
        ) : !earnings ? (
          <AppCard style={styles.card} padded>
            <Text style={styles.cardTitle}>No driver session</Text>
            <Text style={styles.muted}>Sign in as a driver to see earnings from completed payments.</Text>
          </AppCard>
        ) : (
          <>
            <AppCard style={[styles.card, styles.hero]} padded>
              <Text style={styles.heroLabel}>Today (Colombo)</Text>
              <Text style={styles.heroAmount}>LKR {earnings.todayLkr.toLocaleString()}</Text>
              <View style={styles.heroDivider} />
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.smallLabel}>All paid trips (fare)</Text>
                  <Text style={styles.heroSubAmount}>LKR {earnings.totalLkr.toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.smallLabel}>Days with payouts</Text>
                  <Text style={styles.heroSubAmount}>{earnings.daily.length}</Text>
                </View>
              </View>
              {earnings.note ? <Text style={styles.note}>{earnings.note}</Text> : null}
            </AppCard>

            <Text style={styles.section}>By day</Text>
            {earnings.daily.length === 0 ? (
              <AppCard style={styles.card} padded>
                <Text style={styles.muted}>
                  No earnings yet. Finish an on-demand trip (Finish trip on the active ride screen), then pull to refresh.
                  Passenger payments also appear here when linked.
                </Text>
              </AppCard>
            ) : (
              earnings.daily.map((d) => (
                <AppCard key={d.date} style={styles.card} padded>
                  <View style={styles.dayHeader}>
                    <View>
                      <Text style={styles.dayTitle}>{d.dateLabel}</Text>
                      <Text style={styles.dayMeta}>
                        {d.date} · {d.tripCount} {d.tripCount === 1 ? "line" : "lines"}
                      </Text>
                    </View>
                    <Text style={styles.dayTotal}>LKR {d.totalLkr.toLocaleString()}</Text>
                  </View>
                  {d.trips.length > 0 ? (
                    <View style={styles.tripList}>
                      {d.trips.map((t, i) => (
                        <View key={`${t.kind || "row"}-${t.referenceCode || ""}-${i}`} style={styles.tripRow}>
                          <Text style={styles.tripDesc} numberOfLines={2}>
                            {t.kind === "trip_finished" ? "Trip · " : ""}
                            {t.tripDescription || "Ride"}
                          </Text>
                          <Text style={styles.tripFare}>+{t.fareLkr.toLocaleString()}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </AppCard>
              ))
            )}

            {analytics ? (
              <>
                <Text style={styles.section}>Seat bookings (legacy)</Text>
                <AppCard style={styles.card} padded>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Trip revenue (bookings)</Text>
                    <Text style={styles.metricValue}>LKR {Math.round(analytics.revenue).toLocaleString()}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Occupancy</Text>
                    <Text style={styles.metricValue}>{(analytics.occupancyRate * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Paid bookings</Text>
                    <Text style={styles.metricValue}>{analytics.completedBookings}</Text>
                  </View>
                </AppCard>
              </>
            ) : null}
          </>
        )}

        <PrimaryButton
          title="Trip action"
          onPress={() => router.push("/driver-trip-action")}
          style={{ marginTop: Space.md, marginBottom: Space.xl }}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ScreenBg.light },
  content: {
    paddingTop: Space.sm,
    paddingHorizontal: Layout.screenPaddingX - 2,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  center: { paddingVertical: Space.xl, alignItems: "center", gap: Space.sm },
  muted: { fontSize: 13, color: BrandColors.textMuted, lineHeight: 20 },
  card: {
    marginBottom: Space.sm,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(193, 205, 216, 0.55)",
  },
  hero: { backgroundColor: BrandColors.accentSoft },
  heroLabel: { fontSize: 12, fontWeight: "800", color: BrandColors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  heroAmount: { fontSize: 32, fontWeight: "900", color: BrandColors.primaryDark, marginTop: 6 },
  heroDivider: { height: 1, backgroundColor: BrandColors.border, marginVertical: Space.md },
  heroRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  smallLabel: { fontSize: 11, fontWeight: "700", color: BrandColors.textMuted },
  heroSubAmount: { fontSize: 17, fontWeight: "900", color: BrandColors.textDark, marginTop: 4 },
  note: { marginTop: Space.sm, fontSize: 11, color: BrandColors.textMuted, lineHeight: 16 },
  section: {
    marginTop: Space.md,
    marginBottom: Space.xs,
    ...Typography.overline,
    color: BrandColors.textMuted,
  },
  cardTitle: { fontSize: 16, fontWeight: "900", color: BrandColors.primaryDark, marginBottom: Space.xs },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: Space.md },
  dayTitle: { fontSize: 16, fontWeight: "900", color: BrandColors.textDark },
  dayMeta: { marginTop: 4, fontSize: 12, color: BrandColors.textMuted },
  dayTotal: { fontSize: 18, fontWeight: "900", color: BrandColors.primaryDark },
  tripList: { marginTop: Space.md, paddingTop: Space.sm, borderTopWidth: 1, borderTopColor: BrandColors.surfaceMuted, gap: 8 },
  tripRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  tripDesc: { flex: 1, fontSize: 12, color: BrandColors.textDark, fontWeight: "600" },
  tripFare: { fontSize: 12, fontWeight: "900", color: BrandColors.success },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  metricLabel: { fontSize: 13, fontWeight: "700", color: BrandColors.textMuted },
  metricValue: { fontSize: 15, fontWeight: "900", color: BrandColors.primaryDark },
});
