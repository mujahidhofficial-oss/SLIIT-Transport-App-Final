import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space } from "@/app/_theme/tokens";

type Props = TextInputProps & {
  label?: string;
  containerStyle?: ViewStyle;
};

export function FormTextInput({ label, style, containerStyle, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={BrandColors.textLight}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Space.md },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: BrandColors.textMuted,
    marginBottom: Space.xs,
  },
  input: {
    backgroundColor: BrandColors.surface,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Space.md,
    paddingVertical: 13,
    fontSize: 15,
    color: BrandColors.textDark,
  },
  inputFocused: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.accentSoft,
  },
});
