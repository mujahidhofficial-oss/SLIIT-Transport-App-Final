import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { AppCard } from "@/app/_components/ui/AppCard";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";

export default function ContactUsScreen() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [contactId, setContactId] = useState("");
  const [roleLabel, setRoleLabel] = useState("Passenger");

  useEffect(() => {
    void (async () => {
      const session = await getAuthSession();
      const user = session?.user;
      const id = String(user?.studentId || user?.email || user?.id || "").trim();
      setContactId(id);
      const role = user?.role;
      setRoleLabel(role === "driver" ? "Driver" : role === "admin" ? "Admin" : "Passenger");
    })();
  }, []);

  const canSubmit = useMemo(
    () => Boolean(contactId.trim() && subject.trim() && message.trim().length >= 8 && !loading),
    [contactId, subject, message, loading]
  );

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Check fields", "Please fill subject and a clear message.");
      return;
    }
    try {
      setLoading(true);
      const fullMessage = `[${subject.trim()}] ${message.trim()}`;
      const res = await fetch(`${getApiBaseUrl()}/api/inquiries/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: contactId.trim(),
          message: fullMessage,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        throw new Error(body.message ?? "Failed to submit inquiry");
      }
      Alert.alert("Submitted", "Your message has been sent. We will respond soon.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Unable to send", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader showBack title="Contact Us" subtitle="Reach support for rider or driver help" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.infoCard} padded>
          <View style={styles.roleRow}>
            <Ionicons name="help-buoy-outline" size={20} color={BrandColors.primaryDark} />
            <Text style={styles.roleText}>{roleLabel} support</Text>
          </View>
          <Text style={styles.helpText}>
            Send your issue, payment question, trip issue, or account problem. Our team can review and respond.
          </Text>
        </AppCard>

        <AppCard style={styles.formCard} padded>
          <Text style={styles.label}>Contact ID</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            value={contactId}
            editable={false}
            placeholder="Sign in first"
            placeholderTextColor={BrandColors.textLight}
          />

          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Driver payment not received"
            placeholderTextColor={BrandColors.textLight}
            maxLength={80}
          />

          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Write your issue with details..."
            placeholderTextColor={BrandColors.textLight}
            multiline
            textAlignVertical="top"
            maxLength={1200}
          />

          <PrimaryButton
            title={loading ? "Sending..." : "Send message"}
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            style={{ marginTop: Space.md }}
          />
        </AppCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ScreenBg.light },
  content: {
    paddingTop: Space.sm,
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingBottom: Space.xl,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  infoCard: {
    borderRadius: Radii.xl,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.accentSoft,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  roleText: {
    ...Typography.subhead,
    fontWeight: "800",
    color: BrandColors.primaryDark,
  },
  helpText: {
    marginTop: Space.sm,
    color: BrandColors.textMuted,
    lineHeight: 20,
    fontSize: 13,
  },
  formCard: {
    marginTop: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  label: {
    marginTop: Space.sm,
    marginBottom: 6,
    ...Typography.overline,
    color: BrandColors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: BrandColors.textDark,
    backgroundColor: BrandColors.white,
    fontSize: 15,
  },
  readOnlyInput: {
    backgroundColor: BrandColors.surfaceMuted,
    color: BrandColors.textMuted,
  },
  textArea: {
    minHeight: 140,
    paddingTop: 12,
  },
});
