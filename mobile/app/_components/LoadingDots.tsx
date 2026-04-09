import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { BrandColors } from "@/app/_theme/colors";

type Props = {
  text?: string;
};

export function LoadingDots({ text = "Loading ..." }: Props) {
  const fade = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.3, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [fade]);

  return (
    <View style={styles.wrap}>
      <Animated.Text style={[styles.txt, { opacity: fade }]}>{text}</Animated.Text>
      <Text style={[styles.txt, styles.shadow]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  txt: { fontSize: 18, fontWeight: "800", letterSpacing: 2, color: BrandColors.white },
  shadow: { position: "absolute", top: 8, color: "rgba(0,0,0,0.35)" },
});

