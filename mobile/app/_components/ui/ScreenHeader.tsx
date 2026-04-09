import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { BrandColors } from "@/app/_theme/colors";
import { Typography } from "@/app/_theme/tokens";

type Props = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
  /** Show iOS-style back chevron; calls `onBack` or `router.back()`. */
  showBack?: boolean;
  onBack?: () => void;
};

export function ScreenHeader({ title, subtitle, right, style, showBack, onBack }: Props) {
  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.mainRow}>
        {showBack ? (
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            style={styles.backHit}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={BrandColors.primaryDark} />
          </Pressable>
        ) : null}
        <View style={[styles.textBlock, showBack && styles.textWithBack]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  backHit: {
    width: 40,
    height: 40,
    marginLeft: -6,
    marginTop: -2,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: { flex: 1, minWidth: 0 },
  textWithBack: { paddingRight: 4 },
  right: { alignSelf: "flex-start", marginTop: 2 },
  title: {
    ...Typography.title,
    color: BrandColors.primaryDark,
  },
  subtitle: {
    marginTop: 4,
    ...Typography.subhead,
    color: BrandColors.textMuted,
    lineHeight: 18,
  },
});
