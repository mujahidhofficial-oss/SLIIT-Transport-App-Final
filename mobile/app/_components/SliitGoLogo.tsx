import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { BrandColors } from "@/app/_theme/colors";
import { SliitGoMark } from "@/app/_components/SliitGoMark";

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
  color?: string;
};

export function SliitGoLogo({ size = 56, style, color = BrandColors.primary }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <SliitGoMark size={size} color={color} />
      <View style={styles.textWrap}>
        <Text style={[styles.brand, { color }]}>Sliit</Text>
        <Text style={[styles.brand, styles.go, { color }]}>Go</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  textWrap: { flexDirection: "row", marginTop: 10 },
  brand: { fontSize: 32, fontWeight: "900", letterSpacing: 0.2 },
  go: { marginLeft: 2 },
});

