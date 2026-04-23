import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { AppCard } from "@/app/_components/ui/AppCard";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { clearAuthSession, getAuthSession, type AuthUser } from "@/app/_state/authSession";
import { clearDriverSession } from "@/app/_state/driverSession";

function readProfileField(profile: Record<string, unknown> | undefined, key: string): string {
  const v = profile?.[key];
  return typeof v === "string" ? v.trim() : "";
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={22} color={BrandColors.primaryDark} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles.menuSub} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={BrandColors.textMuted} />
    </TouchableOpacity>
  );
}

export default function Profile() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    const session = await getAuthSession();
    setUser(session?.user ?? null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const profile = user?.profile as Record<string, unknown> | undefined;
  const name = user
    ? String(readProfileField(profile, "fullName") || user.studentId || user.email || "Account")
    : "Guest";
  const email = user?.email ?? "—";
  const studentId = user?.studentId?.trim() || readProfileField(profile, "studentId") || "";
  const phone = readProfileField(profile, "phone");
  const department = readProfileField(profile, "department");
  const role = user?.role ?? "student";
  const roleLabel = role === "driver" ? "Driver" : role === "admin" ? "Admin" : "Passenger";
  const roleHint =
    role === "driver"
      ? "Use the Driver tab for your vehicle, trips, and earnings — all in one place."
      : "Request a driver on demand and check your trip history anytime.";

  const onLogout = async () => {
    await clearAuthSession();
    await clearDriverSession();
    router.replace("/welcome");
  };

  return (
    <ScreenShell>
      <ScreenHeader showBack title="Profile" subtitle="Your SLIIT Go account and shortcuts" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.heroCard} padded>
          <View style={styles.heroInner}>
            <ProfileAvatar size={84} />
            <Text style={styles.heroName}>{name}</Text>
            <View style={[styles.rolePill, role === "driver" && styles.rolePillDriver]}>
              <Ionicons
                name={role === "driver" ? "car-outline" : "school-outline"}
                size={14}
                color={role === "driver" ? BrandColors.primaryDark : BrandColors.textDark}
              />
              <Text style={styles.rolePillText}>{roleLabel}</Text>
            </View>
            <Text style={styles.heroHint}>{roleHint}</Text>
          </View>
        </AppCard>

        <Text style={styles.sectionLabel}>Account details</Text>
        <AppCard style={styles.card} padded>
          <DetailRow label="Email" value={email} icon="mail-outline" />
          {studentId ? <DetailRow label="Student / ID" value={studentId} icon="id-card-outline" /> : null}
          {phone ? <DetailRow label="Phone" value={phone} icon="call-outline" /> : null}
          {department ? <DetailRow label="Department" value={department} icon="business-outline" /> : null}
          {!studentId && !phone && !department ? (
            <Text style={styles.emptyFields}>
              Add more details when you register, or contact support to update your profile.
            </Text>
          ) : null}
        </AppCard>

        <Text style={styles.sectionLabel}>Rides & history</Text>
        <AppCard style={styles.card}>
          {role === "driver" ? (
            <>
              <MenuRow
                icon="time-outline"
                title="Trip history"
                subtitle="On-demand rides you accepted & finished"
                onPress={() => router.push("/trip-history")}
              />
              <View style={styles.menuDivider} />
              <MenuRow
                icon="speedometer-outline"
                title="Driver hub"
                subtitle="Profile, trip action, earnings"
                onPress={() => router.push("/(tabs)/explore")}
              />
              <View style={styles.menuDivider} />
              <MenuRow
                icon="business-outline"
                title="Bank details"
                subtitle="For passenger bank transfers — account & bank name"
                onPress={() => router.push("/driver-bank-details")}
              />
            </>
          ) : (
            <>
              <MenuRow
                icon="navigate-outline"
                title="Request a driver"
                subtitle="On-demand pickup & drop-off"
                onPress={() => router.push("/ride-request")}
              />
              <View style={styles.menuDivider} />
              <MenuRow
                icon="time-outline"
                title="Trip history"
                subtitle="Your requests & seat bookings"
                onPress={() => router.push("/trip-history")}
              />
            </>
          )}
        </AppCard>

        <Text style={styles.sectionLabel}>Support</Text>
        <AppCard style={styles.card}>
          <MenuRow
            icon="chatbubbles-outline"
            title="Contact us"
            subtitle="Send a message to support for passenger or driver issues"
            onPress={() => router.push("/contact-us")}
          />
        </AppCard>

        <AppCard style={[styles.footerCard, { marginBottom: Space.xl }]} padded>
          <PrimaryButton title="Log out" variant="outline" onPress={() => void onLogout()} />
          <Text style={styles.footerNote}>You will need to sign in again to book or drive.</Text>
        </AppCard>
      </ScrollView>
    </ScreenShell>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={BrandColors.primary} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={3}>
          {value}
        </Text>
      </View>
    </View>
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
  heroCard: {
    marginTop: Space.sm,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  heroInner: { alignItems: "center" },
  heroName: { ...Typography.title, color: BrandColors.primaryDark, marginTop: Space.md, textAlign: "center" },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Space.sm,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  rolePillDriver: { backgroundColor: "rgba(11, 119, 197, 0.12)", borderColor: "rgba(11, 119, 197, 0.35)" },
  rolePillText: { fontSize: 12, fontWeight: "800", color: BrandColors.textDark },
  heroHint: {
    marginTop: Space.md,
    ...Typography.subhead,
    color: BrandColors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Space.sm,
  },
  sectionLabel: {
    marginTop: Space.lg,
    marginBottom: Space.sm,
    ...Typography.overline,
    color: BrandColors.textMuted,
  },
  card: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(193, 205, 216, 0.55)",
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    paddingVertical: Space.sm,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: { fontSize: 11, fontWeight: "700", color: BrandColors.textMuted, marginBottom: 4 },
  detailValue: { fontSize: 15, fontWeight: "700", color: BrandColors.textDark },
  emptyFields: {
    fontSize: 13,
    color: BrandColors.textMuted,
    lineHeight: 20,
    paddingVertical: Space.xs,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.md,
  },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: { fontSize: 16, fontWeight: "800", color: BrandColors.textDark },
  menuSub: { marginTop: 3, fontSize: 12, color: BrandColors.textMuted, lineHeight: 18 },
  menuDivider: { height: 1, backgroundColor: BrandColors.surfaceMuted, marginLeft: 44 + Space.md * 2 },
  footerCard: {
    marginTop: Space.lg,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  footerNote: {
    marginTop: Space.sm,
    fontSize: 12,
    color: BrandColors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
});
