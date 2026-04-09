import React from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Radii } from "@/app/_theme/tokens";

type Props = ViewProps & { padded?: boolean };

export function AppCard({ children, style, padded = true, ...rest }: Props) {
  return (
    <View style={[styles.base, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: BrandColors.surface,
    borderRadius: Radii.lg,
    ...Elevated.soft,
  },
  padded: {
    padding: 14,
  },
});
