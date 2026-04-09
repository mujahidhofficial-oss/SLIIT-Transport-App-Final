import { StyleSheet } from "react-native";
import { useEffect, useCallback } from "react";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LinearGradient } from "expo-linear-gradient";
import { BrandColors } from "@/app/_theme/colors";
import { ScreenBg } from "@/app/_theme/tokens";
import { SliitGoLogo } from "@/app/_components/SliitGoLogo";

// Keep native splash visible while we load
SplashScreen.preventAutoHideAsync();

export default function Splash() {

  const onLayoutRootView = useCallback(async () => {
    // Hide native splash once React splash is ready
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/loading");
    }, 1300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={[ScreenBg.heroTop, BrandColors.sky, ScreenBg.heroBottom]}
      style={styles.container}
      onLayout={onLayoutRootView}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <SliitGoLogo size={64} color={BrandColors.white} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});