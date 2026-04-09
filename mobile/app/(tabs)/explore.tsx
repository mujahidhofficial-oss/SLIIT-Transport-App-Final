import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { DriverProfileFormCard } from "@/app/_components/DriverProfileFormCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { AppCard } from "@/app/_components/ui/AppCard";

const SHORTCUTS = [
  { title: "Trip action", subtitle: "Pending rides, map, accept & finish", icon: "map-outline" as const, route: "/driver-trip-action" },
  { title: "Trip history", subtitle: "Rides you accepted & completed", icon: "time-outline" as const, route: "/trip-history" },
  { title: "Driver earnings", subtitle: "Trips finished & payments", icon: "wallet-outline" as const, route: "/driver-earnings" },
] as const;

const FLOW_STEPS = [
  { step: "1", label: "Vehicle", hint: "Below" },
  { step: "2", label: "Trips", hint: "Accept" },
  { step: "3", label: "Earn", hint: "History" },
] as const;

function FlowSteps() {
  return (
    <View style={styles.flowRow}>
      {FLOW_STEPS.map((s, i) => (
        <React.Fragment key={s.step}>
          {i > 0 ? <View style={styles.flowDash} /> : null}
          <View style={styles.flowItem}>
            <View style={styles.flowCircle}>
              <Text style={styles.flowCircleText}>{s.step}</Text>
            </View>
            <Text style={styles.flowLabel}>{s.label}</Text>
            <Text style={styles.flowHint}>{s.hint}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={ScreenBg.light} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Space.lg,
            paddingBottom: Space.xxl + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <View style={styles.titleAccent} />
          <Text style={styles.pageTitle}>Driver hub</Text>
          <Text style={styles.pageSub}>
            One place for your vehicle, incoming requests, and payouts — follow the flow top to bottom.
          </Text>
        </View>

        <FlowSteps />

        <PrimaryButton
          title="Open trip queue"
          onPress={() => router.push("/driver-trip-action")}
          style={styles.heroCta}
        />
        <Text style={styles.ctaHint}>See pending rides, map, accept, then active trip & finish.</Text>

        <AppCard style={styles.hero} padded>
          <View style={styles.heroTop}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="speedometer-outline" size={22} color={BrandColors.primaryDark} />
            </View>
            <View style={styles.heroTitleRow}>
              <Text style={styles.heroTitle}>While you drive</Text>
              <View style={styles.heroPill}>
                <View style={styles.liveDot} />
                <Text style={styles.heroPillText}>Live queue</Text>
              </View>
            </View>
          </View>
          <Text style={styles.heroBody}>
            Trip queue is the busiest screen — keep phone reachable for new requests after your vehicle card is filled in.
          </Text>
        </AppCard>

        <Text style={[styles.sectionLabel, styles.sectionFirst]}>Profile & vehicle</Text>
        <View style={styles.profileSlot}>
          <DriverProfileFormCard />
        </View>

        <Text style={styles.sectionLabel}>More shortcuts</Text>
        <View style={styles.shortcutsGap}>
          {SHORTCUTS.map((item) => (
            <Pressable
              key={item.route}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [pressed && styles.shortcutPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.title}`}
            >
              <AppCard style={styles.row} padded>
                <View style={styles.iconWrap}>
                  <Ionicons name={item.icon} size={22} color={BrandColors.primaryDark} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowSub}>{item.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={BrandColors.textMuted} />
              </AppCard>
            </Pressable>
          ))}
        </View>

        <AppCard style={styles.tipCard} padded>
          <View style={styles.tipHeader}>
            <View style={styles.tipIconWrap}>
              <Ionicons name="bulb-outline" size={18} color={BrandColors.primaryDark} />
            </View>
            <Text style={styles.tipTitle}>Tip</Text>
          </View>
          <Text style={styles.tipBody}>
            Accurate vehicle and contact details mean faster pickups and fewer cancelled requests.
          </Text>
        </AppCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ScreenBg.light },
  scroll: { flex: 1, backgroundColor: ScreenBg.light },
  content: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  titleBlock: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: Space.sm,
    marginBottom: Space.md,
  },
  titleAccent: {
    width: 40,
    height: 4,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.primary,
  },
  pageTitle: { ...Typography.largeTitle, color: BrandColors.primaryDark },
  pageSub: { ...Typography.subhead, color: BrandColors.textMuted, lineHeight: 22, maxWidth: 360 },
  flowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Space.lg,
    paddingVertical: Space.sm,
  },
  flowDash: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(8, 94, 155, 0.2)",
    alignSelf: "center",
    marginTop: 18,
    marginHorizontal: 4,
    maxWidth: 36,
    borderRadius: Radii.pill,
  },
  flowItem: { alignItems: "center", width: 72 },
  flowCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Space.xs,
  },
  flowCircleText: { fontSize: 14, fontWeight: "900", color: BrandColors.white },
  flowLabel: { fontSize: 12, fontWeight: "800", color: BrandColors.primaryDark },
  flowHint: { fontSize: 10, fontWeight: "600", color: BrandColors.textMuted, marginTop: 2 },
  heroCta: { width: "100%", minHeight: 52, borderRadius: Radii.lg },
  ctaHint: {
    marginTop: Space.sm,
    marginBottom: Space.md,
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 17,
    textAlign: "center",
  },
  hero: {
    marginTop: Space.xs,
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.12)",
    ...Elevated.soft,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.md,
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.12)",
  },
  heroTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Space.sm,
  },
  heroTitle: { fontSize: 18, fontWeight: "900", color: BrandColors.primaryDark, letterSpacing: -0.2 },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radii.pill,
    backgroundColor: "rgba(13, 177, 75, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(13, 177, 75, 0.3)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.success,
  },
  heroPillText: { fontSize: 11, fontWeight: "800", color: BrandColors.success, letterSpacing: 0.3 },
  heroBody: {
    marginTop: Space.md,
    fontSize: 14,
    color: BrandColors.textDark,
    lineHeight: 22,
  },
  sectionLabel: {
    marginTop: Space.lg,
    marginBottom: Space.xs,
    ...Typography.overline,
    color: BrandColors.textMuted,
  },
  sectionFirst: { marginTop: Space.lg },
  profileSlot: { marginTop: Space.sm },
  shortcutsGap: { marginTop: Space.sm, gap: Space.md },
  shortcutPressed: { opacity: 0.92 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(193, 205, 216, 0.55)",
  },
  rowText: { flex: 1, minWidth: 0 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.5)",
  },
  rowTitle: { fontSize: 16, fontWeight: "800", color: BrandColors.textDark, lineHeight: 22 },
  rowSub: { marginTop: 3, fontSize: 12, color: BrandColors.textMuted, lineHeight: 18 },
  tipCard: {
    marginTop: Space.xl,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.12)",
  },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  tipTitle: { fontSize: 14, fontWeight: "800", color: BrandColors.primaryDark },
  tipBody: { marginTop: Space.sm, fontSize: 13, color: BrandColors.textDark, lineHeight: 21 },
});
