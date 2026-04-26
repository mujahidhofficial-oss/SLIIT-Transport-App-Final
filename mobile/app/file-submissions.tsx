import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space, Typography } from "@/app/_theme/tokens";
import { type DriverBankDetailsPublic, fetchDriverBankDetails, getApiBaseUrl } from "@/app/_state/api";

type PickedFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

function bytesLabel(n?: number) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileSubmissionsScreen() {
  const params = useLocalSearchParams<{
    paymentId?: string;
    ref?: string;
    total?: string;
    driverId?: string;
    requestId?: string;
  }>();
  const referenceCode = params.ref ?? "REF-000000-000";
  const total = params.total ?? "0.00";
  const paymentId = params.paymentId ?? "";
  const [driverBank, setDriverBank] = useState<DriverBankDetailsPublic | null>(null);
  const [bankLoading, setBankLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = (params.driverId ?? "").trim() || "demo-driver";
      setBankLoading(true);
      try {
        const d = await fetchDriverBankDetails(getApiBaseUrl(), id);
        if (!cancelled) setDriverBank(d);
      } catch {
        if (!cancelled) setDriverBank(null);
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.driverId]);

  const [file, setFile] = useState<PickedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const fileMeta = useMemo(() => {
    if (!file) return "";
    const parts = [file.name, bytesLabel(file.size)].filter(Boolean);
    return parts.join(" • ");
  }, [file]);

  const pick = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      setFile({
        uri: asset.uri,
        name: asset.name ?? "upload",
        mimeType: asset.mimeType,
        size: asset.size,
      });
      setValidationMessages([]);
    } catch {
      Alert.alert("Error", "Unable to open file picker.");
    }
  };

  const submit = async () => {
    if (loading) return;
    const issues: string[] = [];
    if (!file) issues.push("Choose an image or PDF of the bank slip");
    if (!paymentId) issues.push("Payment id missing — restart from payment method");
    if (issues.length > 0) {
      setValidationMessages(issues);
      return;
    }
    setValidationMessages([]);

    setLoading(true);
    try {
      const apiBaseUrl = getApiBaseUrl();

      const formData = new FormData();
      formData.append("slip", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "image/jpeg",
      } as any);

      const uploadRes = await fetch(`${apiBaseUrl}/api/payments/demo/${paymentId}/upload-slip`, {
        method: "POST",
        body: formData,
      });

      const uploadBody = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadBody?.message || "Upload failed");
      }

      await fetch(`${apiBaseUrl}/api/payments/demo/${paymentId}/verify-cash`, { method: "PUT" }).catch(() => null);

      router.replace({
        pathname: "/payment-success",
        params: {
          paymentId,
          ref: referenceCode,
          total,
          method: "bank",
          requestId: params.requestId ?? "",
          driverId: params.driverId ?? "",
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Add bank slip" subtitle={`Reference ${referenceCode}`} showBack />

      <View style={styles.topRow}>
        <ProfileAvatar size={46} />
        <View style={styles.badge}>
          <Ionicons name="cash-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.badgeText}>{total}</Text>
        </View>
      </View>

      {validationMessages.length > 0 ? (
        <View style={styles.paymentValidationBox} accessibilityLiveRegion="polite">
          <Text style={styles.paymentValidationTitle}>Please fix the following</Text>
          {validationMessages.map((line, i) => (
            <Text key={`${line}-${i}`} style={styles.paymentValidationLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      <AppCard style={styles.bankCard} padded>
        <View style={styles.bankHeader}>
          <Ionicons name="business-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.bankTitle}>Driver bank details</Text>
        </View>
        {bankLoading ? (
          <Text style={styles.bankEmpty}>Loading…</Text>
        ) : !driverBank?.hasBankDetails ? (
          <Text style={styles.bankEmpty}>
            Bank details are not set for this driver. Use the amount and reference above; confirm the account with your driver if needed.
          </Text>
        ) : (
          <>
            {driverBank.driverFullName ? (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Reference name</Text>
                <Text style={styles.bankValue}>{driverBank.driverFullName}</Text>
              </View>
            ) : null}
            {driverBank.bankAccountName ? (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account name</Text>
                <Text style={styles.bankValue}>{driverBank.bankAccountName}</Text>
              </View>
            ) : null}
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Bank</Text>
              <Text style={styles.bankValue}>{driverBank.bankName}</Text>
            </View>
            {driverBank.bankBranch ? (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Branch</Text>
                <Text style={styles.bankValue}>{driverBank.bankBranch}</Text>
              </View>
            ) : null}
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Account no.</Text>
              <Text style={styles.bankValue}>{driverBank.bankAccountNumber}</Text>
            </View>
          </>
        )}
      </AppCard>

      <AppCard style={styles.card} padded={false}>
        <View style={styles.cardHeader}>
          <View style={styles.dot} />
          <Text style={styles.cardHeaderText}>Add submission</Text>
        </View>

        <View style={styles.cardSubHeader}>
          <Text style={styles.subLeft}>File submissions</Text>
          <Text style={styles.subRight}>Accepted: JPG/PNG/PDF</Text>
        </View>

        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>Add…</Text>
          <Ionicons name="folder-open-outline" size={14} color={BrandColors.textMuted} />
          <View style={{ flex: 1 }} />
          <Ionicons name="menu-outline" size={16} color={BrandColors.textMuted} />
          <Ionicons name="ellipsis-vertical" size={14} color={BrandColors.textMuted} />
        </View>

        <Pressable style={styles.dropZone} onPress={() => void pick()}>
          <Ionicons name="cloud-upload-outline" size={24} color={BrandColors.primary} />
          <Text style={styles.dropText}>
            {file ? fileMeta : "You can drag and drop files here to add them."}
          </Text>
          <Text style={styles.dropHint}>Tap to choose an image or PDF</Text>
        </Pressable>
      </AppCard>

      <PrimaryButton
        title={loading ? "Submitting..." : "Submit"}
        onPress={() => void submit()}
        style={{ marginTop: Space.xl }}
        disabled={loading}
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push({ pathname: "/order-processing" })}
        accessibilityRole="button"
        accessibilityLabel="Restart payment flow"
      >
        <Ionicons name="refresh" size={18} color={BrandColors.white} />
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  topRow: {
    marginTop: Space.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  badgeText: { fontSize: 13, fontWeight: "900", color: BrandColors.primaryDark },
  paymentValidationBox: {
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginTop: Space.sm,
  },
  paymentValidationTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#B00020",
    marginBottom: Space.xs,
  },
  paymentValidationLine: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textDark,
    lineHeight: 18,
    marginTop: 2,
  },
  bankCard: { marginTop: Space.md },
  bankEmpty: { ...Typography.subhead, color: BrandColors.textMuted, lineHeight: 20 },
  bankHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Space.sm,
  },
  bankTitle: { fontSize: 13, fontWeight: "900", color: BrandColors.primaryDark },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.surfaceMuted,
  },
  bankLabel: { fontSize: 12, fontWeight: "700", color: BrandColors.textMuted },
  bankValue: { fontSize: 12, fontWeight: "800", color: BrandColors.textDark, maxWidth: "62%", textAlign: "right" },

  card: { marginTop: Space.md, borderRadius: Radii.lg, overflow: "hidden" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BrandColors.surfaceMuted,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#DCE6EE",
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  cardHeaderText: { ...Typography.caption, color: BrandColors.textMuted },
  cardSubHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  subLeft: { fontSize: 11, fontWeight: "700", color: BrandColors.textMuted },
  subRight: { fontSize: 11, fontWeight: "700", color: BrandColors.textLight },

  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  toolbarText: { fontSize: 12, fontWeight: "800", color: BrandColors.textDark },

  dropZone: {
    marginHorizontal: 12,
    marginBottom: 14,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.accentSoft,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dropText: { fontSize: 12, fontWeight: "700", color: BrandColors.primaryDark, textAlign: "center" },
  dropHint: { fontSize: 11, fontWeight: "600", color: BrandColors.textMuted, textAlign: "center" },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});

