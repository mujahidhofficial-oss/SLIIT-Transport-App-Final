import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BrandColors } from "@/app/_theme/colors";
import { ScreenBg } from "@/app/_theme/tokens";
import { LoadingDots } from "@/app/_components/LoadingDots";
import { getAuthSession } from "@/app/_state/authSession";

export default function Loading() {
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        const session = await getAuthSession();
        router.replace(session ? "/(tabs)" : "/welcome");
      })();
    }, 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <LinearGradient
      colors={[ScreenBg.heroTop, BrandColors.sky]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <LoadingDots text="Loading…" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});

