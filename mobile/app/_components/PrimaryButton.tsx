import React from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { BrandColors } from "@/app/_theme/colors";
import { Radii } from "@/app/_theme/tokens";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: "filled" | "outline";
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, variant = "filled", style, disabled }: Props) {
  const isOutline = variant === "outline";

  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.88}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.btn,
        isOutline ? styles.outline : styles.filled,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.txt,
          isOutline ? styles.outlineTxt : styles.filledTxt,
          disabled && styles.disabledTxt,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 50,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  filled: { backgroundColor: BrandColors.primaryDark },
  outline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: BrandColors.primary },
  disabled: { opacity: 0.48, shadowOpacity: 0 },
  txt: { fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  filledTxt: { color: BrandColors.white },
  outlineTxt: { color: BrandColors.primary },
  disabledTxt: { opacity: 0.95 },
});

