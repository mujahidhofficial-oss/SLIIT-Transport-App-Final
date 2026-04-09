import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession, setAuthSession } from "@/app/_state/authSession";

export default function DriverBankDetailsScreen() {
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const auth = await getAuthSession();
    if (!auth?.token || auth.user?.role !== "driver") {
      router.replace("/profile");
      return;
    }
    setLoading(true);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/drivers/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body?.message === "string" ? body.message : "Could not load profile");
      }
      const p = body?.driver?.profile as Record<string, string> | undefined;
      setBankAccountName(String(p?.bankAccountName ?? ""));
      setBankName(String(p?.bankName ?? ""));
      setBankAccountNumber(String(p?.bankAccountNumber ?? ""));
      setBankBranch(String(p?.bankBranch ?? ""));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Load failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onSave = async () => {
    const auth = await getAuthSession();
    if (!auth?.token || auth.user?.role !== "driver") return;
    setSaving(true);
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/drivers/me/bank`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bankAccountName: bankAccountName.trim(),
          bankName: bankName.trim(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankBranch: bankBranch.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof body?.message === "string" ? body.message : "Save failed");
      }
      const profile = body?.driver?.profile as Record<string, unknown> | undefined;
      if (profile && auth.user) {
        await setAuthSession({
          token: auth.token,
          user: {
            ...auth.user,
            profile: { ...(auth.user.profile ?? {}), ...profile },
          },
        });
      }
      Alert.alert("Saved", "Passengers will see these details when they choose bank transfer.");
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      Alert.alert("Error", msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader
        title="Bank transfer details"
        subtitle="Passengers use this when paying you by bank transfer"
        showBack
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={styles.noteCard} padded>
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={22} color={BrandColors.primaryDark} />
            <Text style={styles.noteText}>
              Enter the account that should receive ride payments. Use the name that appears on the bank statement.
            </Text>
          </View>
        </AppCard>

        <AppCard style={styles.formCard} padded>
          <Text style={styles.sectionLabel}>Account</Text>
          <FormTextInput
            label="Account holder name"
            value={bankAccountName}
            onChangeText={setBankAccountName}
            placeholder="e.g. A. B. Perera"
            autoCapitalize="words"
            editable={!loading}
          />
          <FormTextInput
            label="Bank name"
            value={bankName}
            onChangeText={setBankName}
            placeholder="e.g. Bank of Ceylon"
            autoCapitalize="words"
            editable={!loading}
          />
          <FormTextInput
            label="Account number"
            value={bankAccountNumber}
            onChangeText={setBankAccountNumber}
            placeholder="Account number"
            keyboardType="default"
            editable={!loading}
          />
          <FormTextInput
            label="Branch (optional)"
            value={bankBranch}
            onChangeText={setBankBranch}
            placeholder="e.g. Malabe"
            autoCapitalize="words"
            editable={!loading}
          />
        </AppCard>

        <PrimaryButton
          title={saving || loading ? "Please wait…" : "Save bank details"}
          onPress={() => void onSave()}
          disabled={saving || loading}
          style={styles.saveBtn}
        />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: ScreenBg.light },
  content: {
    paddingTop: Space.sm,
    paddingBottom: Space.xxl,
    paddingHorizontal: Layout.screenPaddingX - 2,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
  },
  noteCard: {
    marginTop: Space.sm,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: Space.sm },
  noteText: { flex: 1, ...Typography.subhead, color: BrandColors.textDark, lineHeight: 20 },
  formCard: {
    marginTop: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  sectionLabel: { ...Typography.overline, color: BrandColors.textMuted, marginBottom: Space.sm },
  saveBtn: { marginTop: Space.lg },
});
