import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, ScreenBg, Space } from "@/app/_theme/tokens";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";

export default function ModalScreen() {
  return (
    <View style={styles.outer}>
      <AppCard style={styles.card}>
        <Text style={styles.title}>Quick info</Text>
        <Text style={styles.body}>
          This modal uses the same card and typography as the rest of the transport app.
        </Text>
        <PrimaryButton title="Back to app" onPress={() => router.back()} />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    backgroundColor: ScreenBg.light,
    alignItems: "center",
    justifyContent: "center",
    padding: Layout.screenPaddingX,
  },
  card: { width: "100%", maxWidth: 400 },
  title: { fontSize: 20, fontWeight: "900", color: BrandColors.primaryDark, marginBottom: Space.sm },
  body: { fontSize: 14, color: BrandColors.textMuted, lineHeight: 21, marginBottom: Space.lg },
});
