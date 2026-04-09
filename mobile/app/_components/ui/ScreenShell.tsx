import React from "react";
import { ScrollView, ScrollViewProps, StyleSheet, View, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, ScreenBg, Space } from "@/app/_theme/tokens";

type Props = ScrollViewProps & {
  children: React.ReactNode;
  noPadding?: boolean;
};

/** Standard scrollable screen: app background + horizontal padding + max width on web/tablet. */
export function ScreenShell({ children, contentContainerStyle, noPadding, ...rest }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Space.sm,
          paddingBottom: Math.max(insets.bottom, Space.lg) + 16,
        },
        noPadding ? { paddingHorizontal: 0 } : { paddingHorizontal: Layout.screenPaddingX - 2 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenFixed({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.fixed, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ScreenBg.light },
  content: {
    flexGrow: 1,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  fixed: {
    flex: 1,
    backgroundColor: ScreenBg.light,
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.lg,
  },
});
