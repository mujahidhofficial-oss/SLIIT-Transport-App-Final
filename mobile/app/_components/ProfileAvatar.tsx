import React from "react";
import { Image, ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { BrandColors } from "@/app/_theme/colors";

type Props = {
  size?: number;
  source?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
};

// Simple circular avatar with soft card background like the wireframes.
export function ProfileAvatar({ size = 64, source, style }: Props) {
  const radius = size / 2;
  return (
    <View style={[styles.card, { width: size + 16, height: size + 16, borderRadius: radius + 8 }, style]}>
      <View style={[styles.inner, { width: size, height: size, borderRadius: radius }]}>
        <Image
          source={
            source ?? {
              uri: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&w=120",
            }
          }
          style={{ width: size, height: size, borderRadius: radius }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 8,
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inner: {
    overflow: "hidden",
  },
});

