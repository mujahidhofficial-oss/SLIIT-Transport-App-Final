import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BrandColors } from "@/app/_theme/colors";

type Props = {
  label: string;
  placeholder?: string;
  value?: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Rounded pill selector used in many wireframes (blue when idle, green when selected).
export function PillSelect({ label, placeholder = "-------------", value, selected, onPress, style }: Props) {
  const display = value ?? placeholder;

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={onPress}
        style={[
          styles.pill,
          selected ? styles.pillSelected : styles.pillDefault,
        ]}
      >
        <Text style={[styles.text, selected && styles.textSelected]}>{display}</Text>
        <View style={styles.iconCircle}>
          <Ionicons
            name={selected ? "chevron-back" : "chevron-down"}
            size={18}
            color={selected ? BrandColors.primary : BrandColors.primaryDark}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    textAlign: "center",
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "800",
    color: BrandColors.primary,
  },
  pill: {
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pillDefault: {
    backgroundColor: BrandColors.primary,
  },
  pillSelected: {
    backgroundColor: "#21B15A",
  },
  text: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  textSelected: {
    // keep white text on green
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
});

