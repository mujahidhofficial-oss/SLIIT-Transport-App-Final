import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { getAuthSession, type AuthUser } from "@/app/_state/authSession";

const quickActions: QuickAction[] = [
  {
    title: "Request driver",
    subtitle: "On-demand pickup & drop-off",
    icon: <Ionicons name="navigate-outline" size={22} color={BrandColors.primary} />,
    route: "/ride-request",
  },
  {
    title: "Trip history",
    subtitle: "Past rides and status",
    icon: <Ionicons name="time-outline" size={22} color={BrandColors.primary} />,
    route: "/trip-history",
  },
  {
    title: "Profile",
    subtitle: "Account & shortcuts",
    icon: <Ionicons name="person-outline" size={22} color={BrandColors.primary} />,
    route: "/profile",
  },
];

type QuickAction = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: "/ride-request" | "/trip-history" | "/profile";
};

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstNameFromUser(user: AuthUser | null): string {
  const p = user?.profile;
  if (p && typeof p === "object") {
    const fn = (p as { fullName?: string; name?: string }).fullName ?? (p as { name?: string }).name;
    if (typeof fn === "string" && fn.trim()) return fn.trim().split(/\s+/)[0] ?? "";
  }
  const em = user?.email?.trim();
  if (em?.includes("@")) return em.split("@")[0] ?? "";
  return "";
}

function ActionCard({ item, onPress }: { item: QuickAction; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.88} accessibilityRole="button">
      <View style={styles.actionIconWrap}>{item.icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{item.title}</Text>
        {item.subtitle ? <Text style={styles.actionSubtitle}>{item.subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={BrandColors.textMuted} />
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const refreshUser = useCallback(async () => {
    const s = await getAuthSession();
    setUser(s?.user ?? null);
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser])
  );

  const greet = timeGreeting();
  const name = firstNameFromUser(user);
  const heroLine = name ? `${greet}, ${name}` : greet;
  const isDriver = user?.role === "driver";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BrandColors.primaryDark} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <LinearGradient
          colors={[BrandColors.primaryDark, "#0a5588", BrandColors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerArea}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.kicker}>Your rides</Text>
              <Text style={styles.brand}>SLIIT Go</Text>
              <Text style={styles.brandSub}>Home · book a driver in a few taps</Text>
            </View>

            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.88} accessibilityRole="button" accessibilityLabel="Notifications">
              <Ionicons name="notifications-outline" size={22} color={BrandColors.primaryDark} />
            </TouchableOpacity>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{heroLine}</Text>
            <Text style={styles.heroText}>
              This tab is for passengers: request a ride, then track it. Driving? Use the Driver tab in the bar below.
            </Text>

            {isDriver ? (
              <TouchableOpacity
                style={styles.driverJump}
                onPress={() => router.push("/(tabs)/explore")}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Open Driver tab"
              >
                <Ionicons name="car-sport-outline" size={18} color={BrandColors.primaryDark} />
                <Text style={styles.driverJumpText}>You’re signed in as driver — open Driver hub</Text>
                <Ionicons name="chevron-forward" size={18} color={BrandColors.primaryDark} />
              </TouchableOpacity>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.primaryRideCta}
            onPress={() => router.push("/ride-request")}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Request a ride"
          >
            <View style={styles.primaryRideCtaIcon}>
              <Ionicons name="navigate" size={26} color={BrandColors.white} />
            </View>
            <View style={styles.primaryRideCtaText}>
              <Text style={styles.primaryRideCtaTitle}>Request a ride</Text>
              <Text style={styles.primaryRideCtaSub}>Set pickup & drop-off · see fare estimate</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={28} color="rgba(255,255,255,0.92)" />
          </TouchableOpacity>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Shortcuts</Text>
            <Text style={styles.sectionSub}>History, profile, and the same request flow</Text>
          </View>

          {quickActions.map((item) => (
            <ActionCard key={item.title} item={item} onPress={() => router.push(item.route)} />
          ))}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BrandColors.primaryDark,
  },
  container: {
    backgroundColor: ScreenBg.light,
    paddingBottom: Space.xl,
  },
  headerArea: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.md,
    paddingBottom: Space.xl,
    borderBottomLeftRadius: Radii.xl + 4,
    borderBottomRightRadius: Radii.xl + 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Space.lg,
    gap: Space.md,
  },
  kicker: {
    ...Typography.overline,
    color: "rgba(255,255,255,0.72)",
    marginBottom: Space.xs,
  },
  brand: {
    ...Typography.largeTitle,
    color: BrandColors.white,
  },
  brandSub: {
    marginTop: Space.xs,
    fontSize: 15,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
    lineHeight: 21,
  },
  bellBtn: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: Radii.xl,
    padding: Space.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
  },
  heroTitle: {
    ...Typography.title,
    color: BrandColors.primaryDark,
    marginBottom: Space.sm,
  },
  heroText: {
    ...Typography.body,
    lineHeight: 22,
    color: BrandColors.textLight,
  },
  driverJump: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.2)",
  },
  driverJumpText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    lineHeight: 18,
  },
  section: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.lg,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  primaryRideCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radii.xl,
    backgroundColor: BrandColors.primaryDark,
    marginBottom: Space.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...Elevated.card,
  },
  primaryRideCtaIcon: {
    width: 52,
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryRideCtaText: { flex: 1, minWidth: 0 },
  primaryRideCtaTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BrandColors.white,
    letterSpacing: -0.2,
  },
  primaryRideCtaSub: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 18,
  },
  sectionHead: {
    marginBottom: Space.md,
  },
  sectionTitle: {
    ...Typography.title,
    color: BrandColors.textDark,
  },
  sectionSub: {
    marginTop: 4,
    ...Typography.subhead,
    color: BrandColors.textMuted,
    lineHeight: 20,
  },
  actionCard: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.xl,
    padding: Space.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Space.md,
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.55)",
    ...Elevated.soft,
  },
  actionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Space.md,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.1)",
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: BrandColors.textDark,
  },
  actionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: BrandColors.textMuted,
    lineHeight: 18,
  },
  bottomSpace: {
    height: Space.lg,
  },
});
