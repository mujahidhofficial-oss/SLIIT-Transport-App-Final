import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BottomWave } from "@/app/_components/illustrations/BottomWave";

export default function Welcome() {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[ScreenBg.heroTop, BrandColors.sky, ScreenBg.heroBottom]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Space.md,
            paddingBottom: Math.max(insets.bottom, Space.lg) + Space.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.topCard, styles.narrow]}>
          <View style={styles.heroRing}>
            <View style={styles.heroImageWrap}>
              <Image
                source={require("../assets/images/welcome-sliitgo-hero.png")}
                style={styles.heroImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel="SliitGo — astronaut driving a campus shuttle"
              />
            </View>
          </View>

          <Text style={styles.topTitle}>SliitGo</Text>
          <Text style={styles.topTag}>Campus transport</Text>
          <Text style={styles.topDesc}>
            Book shared rides, follow your trip, and let drivers manage bookings — one simple app for SLIIT travel.
          </Text>
        </View>

        <View style={styles.waveBetween} pointerEvents="none">
          <BottomWave color="rgba(255,255,255,0.32)" />
        </View>

        <View style={[styles.bottomCard, styles.narrow]}>
          <View style={styles.authHeaderRow}>
            <Text style={styles.authOverline}>Account</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(auth)", params: { tab: "login" } })}
              hitSlop={12}
              style={({ pressed }) => [styles.forgotWrap, pressed && styles.forgotPressed]}
              accessibilityRole="link"
              accessibilityLabel="Forgot password — open login"
            >
              <Text style={styles.forgot}>Forgot?</Text>
              <Ionicons name="chevron-forward" size={14} color={BrandColors.primary} style={styles.forgotChevron} />
            </Pressable>
          </View>

          <View style={styles.btnCol}>
            <PrimaryButton
              title="Login"
              onPress={() => router.push({ pathname: "/(auth)", params: { tab: "login" } })}
              style={styles.btnFull}
            />
            <PrimaryButton
              title="Sign up"
              variant="outline"
              onPress={() => router.push({ pathname: "/(auth)", params: { tab: "signup" } })}
              style={styles.btnFull}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Quick unlock</Text>
          <Pressable
            onPress={() => router.push({ pathname: "/(auth)", params: { tab: "login" } })}
            style={({ pressed }) => [styles.fingerprintBox, pressed && styles.fingerprintPressed]}
            accessibilityRole="button"
            accessibilityLabel="Open login for biometric sign-in"
          >
            <MaterialCommunityIcons name="fingerprint" size={44} color={BrandColors.primaryDark} />
          </Pressable>
          <Text style={styles.fingerprintHint}>Use device login, then enable biometrics in settings.</Text>

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Or continue with</Text>
          <View style={styles.socialRow}>
            <SocialChip icon={<Ionicons name="logo-facebook" size={22} color={BrandColors.white} />} filled />
            <SocialChip
              icon={<Ionicons name="logo-google" size={20} color={BrandColors.primaryDark} />}
              light
            />
            <SocialChip icon={<Ionicons name="logo-apple" size={24} color={BrandColors.white} />} filled />
          </View>

          <Text style={styles.footer}>SliitGo · SLIIT Transport</Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function SocialChip({
  icon,
  filled,
  light,
}: {
  icon: React.ReactNode;
  filled?: boolean;
  light?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.socialCircle,
        filled && styles.socialCircleFilled,
        light && styles.socialCircleLight,
        pressed && styles.socialCirclePressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Social sign-in (coming soon)"
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Space.md,
  },
  narrow: {
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  topCard: {
    marginTop: Space.xs,
    borderRadius: Radii.xl + 4,
    padding: Space.lg,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    ...Elevated.card,
  },
  heroRing: {
    alignSelf: "center",
    width: 200,
    height: 200,
    borderRadius: 100,
    padding: 4,
    backgroundColor: "rgba(227, 242, 253, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.12)",
    ...Elevated.soft,
  },
  heroImageWrap: {
    width: "100%",
    height: "100%",
    borderRadius: 9999,
    overflow: "hidden",
    backgroundColor: BrandColors.accentSoft,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  topTitle: {
    marginTop: Space.md,
    ...Typography.largeTitle,
    color: BrandColors.primaryDark,
    textAlign: "center",
  },
  topTag: {
    marginTop: Space.xs,
    ...Typography.overline,
    color: BrandColors.primary,
    textAlign: "center",
    letterSpacing: 1,
  },
  topDesc: {
    marginTop: Space.md,
    ...Typography.subhead,
    lineHeight: 22,
    color: BrandColors.textDark,
    textAlign: "center",
    paddingHorizontal: Space.sm,
  },

  waveBetween: {
    marginTop: -8,
    marginBottom: -20,
    height: 88,
    alignItems: "center",
    justifyContent: "flex-end",
    overflow: "hidden",
    opacity: 0.92,
  },

  bottomCard: {
    marginTop: Space.sm,
    paddingTop: Space.lg,
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xl,
    borderRadius: Radii.xl + 8,
    backgroundColor: BrandColors.white,
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.5)",
    ...Elevated.card,
  },
  authHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Space.md,
  },
  authOverline: {
    ...Typography.overline,
    color: BrandColors.textMuted,
    letterSpacing: 1,
  },

  forgotWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingLeft: 8,
    gap: 2,
  },
  forgotPressed: { opacity: 0.7 },
  forgot: { color: BrandColors.primary, fontWeight: "800", fontSize: 13 },
  forgotChevron: { marginTop: 1 },

  btnCol: {
    flexDirection: "column",
    gap: Space.sm,
    width: "100%",
  },
  btnFull: { width: "100%", alignSelf: "stretch" },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BrandColors.border,
    marginTop: Space.lg,
    marginBottom: Space.sm,
    opacity: 0.9,
  },

  sectionLabel: {
    ...Typography.overline,
    color: BrandColors.textMuted,
    textAlign: "center",
    marginTop: Space.md,
  },
  sectionLabelSpaced: { marginTop: Space.lg },

  fingerprintBox: {
    marginTop: Space.md,
    alignSelf: "center",
    width: 80,
    height: 80,
    borderRadius: Radii.xl,
    borderWidth: 2,
    borderColor: "rgba(8, 94, 155, 0.35)",
    backgroundColor: BrandColors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    ...Elevated.soft,
  },
  fingerprintPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  fingerprintHint: {
    marginTop: Space.sm,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    color: BrandColors.textMuted,
    lineHeight: 16,
    paddingHorizontal: Space.md,
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Space.md,
    gap: Space.lg,
    flexWrap: "wrap",
  },
  socialCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  socialCircleFilled: {
    backgroundColor: BrandColors.primaryDark,
    borderColor: "rgba(0,0,0,0.06)",
    ...Elevated.soft,
  },
  socialCircleLight: {
    backgroundColor: BrandColors.white,
    borderColor: BrandColors.border,
    ...Elevated.soft,
  },
  socialCirclePressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },

  footer: {
    textAlign: "center",
    marginTop: Space.xl,
    ...Typography.caption,
    color: BrandColors.textMuted,
    fontWeight: "600",
  },
});
