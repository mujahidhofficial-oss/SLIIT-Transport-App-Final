import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { AppCard } from "@/app/_components/ui/AppCard";
import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { FormTextInput } from "@/app/_components/ui/FormTextInput";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { BrandColors } from "@/app/_theme/colors";
import { Layout, Radii, Space, Typography } from "@/app/_theme/tokens";
import { type DriverBankDetailsPublic, fetchDriverBankDetails, getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";

function makeReferenceCode() {
  return `REF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
}

function toMoney(input: string) {
  const n = Number(input.replace(/,/g, "."));
  if (Number.isFinite(n)) return n;
  return 0;
}

/** Matches `createDemoPayment` checks in `letgo-driver-module/controllers/paymentDemoController.js`. */
function validatePaymentBill(form: {
  tripDescription: string;
  basicClassification: string;
  subcategory: string;
  amount: string;
  adminFee: string;
}): string[] {
  const errs: string[] = [];
  if (!form.tripDescription.trim()) errs.push("Trip description is required");
  if (!form.basicClassification.trim()) errs.push("Basic classification is required");
  if (!form.subcategory.trim()) errs.push("Subcategory is required");
  const a = toMoney(form.amount);
  const f = toMoney(form.adminFee);
  if (a <= 0) errs.push("Amount must be greater than 0");
  if (f < 0) errs.push("Admin fee cannot be negative");
  if (a + f <= 0) errs.push("Total must be greater than 0");
  return errs;
}

export default function OrderProcessingScreen() {
  const params = useLocalSearchParams<{
    requestId?: string;
    tripDescription?: string;
    tipDescription?: string;
    basicClassification?: string;
    subcategory?: string;
    amount?: string;
    adminFee?: string;
    driverId?: string;
  }>();
  const [referenceCode] = useState(() => makeReferenceCode());
  const [form, setForm] = useState({
    tripDescription: params.tripDescription ?? "",
    tipDescription: params.tipDescription ?? "",
    basicClassification: params.basicClassification ?? "",
    subcategory: params.subcategory ?? "",
    amount: params.amount ?? "",
    adminFee: params.adminFee ?? "",
  });
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [bankDetails, setBankDetails] = useState<DriverBankDetailsPublic | null>(null);
  const [bankLoading, setBankLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let driverId = (params.driverId ?? "").trim();
      const requestId = (params.requestId ?? "").trim();
      if (requestId) {
        try {
          const auth = await getAuthSession();
          const customerId = auth?.user?.id ? String(auth.user.id) : "";
          if (customerId) {
            const base = getApiBaseUrl();
            const lookup = await fetch(
              `${base}/api/ride-requests/${encodeURIComponent(requestId)}?customerId=${encodeURIComponent(customerId)}`
            );
            const lj = (await lookup.json().catch(() => ({}))) as {
              driverId?: string;
              fareToPayLkr?: number;
            };
            if (lookup.ok && !cancelled) {
              if (!driverId && lj?.driverId) driverId = String(lj.driverId).trim();
              const ftp = Math.round(Number(lj?.fareToPayLkr));
              if (Number.isFinite(ftp) && ftp > 0) {
                setForm((s) => ({ ...s, amount: String(ftp) }));
              }
            }
          }
        } catch {
          /* ignore */
        }
      }
      if (!driverId) {
        setBankDetails(null);
        return;
      }
      setBankLoading(true);
      try {
        const d = await fetchDriverBankDetails(getApiBaseUrl(), driverId);
        if (!cancelled) setBankDetails(d);
      } catch {
        if (!cancelled) setBankDetails(null);
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.driverId, params.requestId]);

  const total = useMemo(() => {
    return (toMoney(form.amount) + toMoney(form.adminFee)).toFixed(2);
  }, [form.amount, form.adminFee]);

  const patchForm = (patch: Partial<typeof form>) => {
    setValidationMessages([]);
    setForm((s) => ({ ...s, ...patch }));
  };

  const onPayNow = () => {
    const issues = validatePaymentBill(form);
    if (issues.length > 0) {
      setValidationMessages(issues);
      return;
    }
    router.push({
      pathname: "/payment-method",
      params: {
        ref: referenceCode,
        tripDescription: form.tripDescription,
        tipDescription: form.tipDescription,
        amount: form.amount,
        adminFee: form.adminFee,
        basicClassification: form.basicClassification,
        subcategory: form.subcategory,
        total,
        driverId: params.driverId ?? "",
        requestId: params.requestId ?? "",
      },
    });
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Process" subtitle="Bill details" showBack />

      <View style={styles.topRow}>
        <ProfileAvatar size={46} />
        <View style={styles.refPill}>
          <Ionicons name="barcode-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.refText}>{referenceCode}</Text>
        </View>
      </View>

      <AppCard style={styles.card} padded>
        <Text style={styles.sectionLabel}>Details</Text>
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
        <FormTextInput
          label="Trip description"
          value={form.tripDescription}
          onChangeText={(v) => patchForm({ tripDescription: v })}
          placeholder="Enter trip description"
        />
        <FormTextInput
          label="Tip description"
          value={form.tipDescription}
          onChangeText={(v) => patchForm({ tipDescription: v })}
          placeholder="Enter tip description"
        />
        <FormTextInput
          label="Basic classification"
          value={form.basicClassification}
          onChangeText={(v) => patchForm({ basicClassification: v })}
          placeholder="Enter basic classification"
        />
        <FormTextInput
          label="Subcategory"
          value={form.subcategory}
          onChangeText={(v) => patchForm({ subcategory: v })}
          placeholder="Enter subcategory"
        />

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>Cost</Text>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <FormTextInput
              label="Amount"
              value={form.amount}
              onChangeText={(v) => patchForm({ amount: v })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ width: Space.md }} />
          <View style={{ flex: 1 }}>
            <FormTextInput
              label="Admin fee"
              value={form.adminFee}
              onChangeText={(v) => patchForm({ adminFee: v })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>

        {params.driverId || params.requestId ? (
          <View style={styles.bankSection}>
            <Text style={styles.bankSectionLabel}>If you pay by bank transfer</Text>
            <Text style={styles.bankSectionHint}>
              You will choose bank transfer on the next screen; transfer to this account and keep the slip.
            </Text>
            {bankLoading ? (
              <Text style={styles.bankMuted}>Loading driver bank details…</Text>
            ) : !bankDetails?.hasBankDetails ? (
              <Text style={styles.bankWarn}>
                This driver has not added bank details yet. Use cash on the next screen, or confirm the account with the driver.
              </Text>
            ) : (
              <View style={styles.bankRows}>
                {bankDetails.driverFullName ? (
                  <View style={styles.bankRow}>
                    <Text style={styles.bankKey}>Reference name</Text>
                    <Text style={styles.bankVal}>{bankDetails.driverFullName}</Text>
                  </View>
                ) : null}
                {bankDetails.bankAccountName ? (
                  <View style={styles.bankRow}>
                    <Text style={styles.bankKey}>Account name</Text>
                    <Text style={styles.bankVal}>{bankDetails.bankAccountName}</Text>
                  </View>
                ) : null}
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>Bank</Text>
                  <Text style={styles.bankVal}>{bankDetails.bankName}</Text>
                </View>
                {bankDetails.bankBranch ? (
                  <View style={styles.bankRow}>
                    <Text style={styles.bankKey}>Branch</Text>
                    <Text style={styles.bankVal}>{bankDetails.bankBranch}</Text>
                  </View>
                ) : null}
                <View style={styles.bankRow}>
                  <Text style={styles.bankKey}>Account no.</Text>
                  <Text style={styles.bankVal}>{bankDetails.bankAccountNumber}</Text>
                </View>
              </View>
            )}
          </View>
        ) : null}

        <PrimaryButton title="Pay now" onPress={onPayNow} style={{ marginTop: Space.sm }} />
      </AppCard>

      <Text style={styles.note}>
        Barcode/reference is generated for demo. Hook this to your backend payment record when ready.
      </Text>
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
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: BrandColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.pill,
    flexShrink: 1,
  },
  refText: { fontSize: 12, fontWeight: "800", color: BrandColors.primaryDark, flexShrink: 1 },
  card: { marginTop: Space.md },
  sectionLabel: { ...Typography.overline, color: BrandColors.textMuted, marginBottom: Space.sm },
  paymentValidationBox: {
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
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
  divider: { height: 1, backgroundColor: BrandColors.surfaceMuted, marginVertical: Space.sm },
  twoCol: { flexDirection: "row" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Space.sm,
    paddingHorizontal: Space.sm,
    backgroundColor: BrandColors.surfaceMuted,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    marginTop: 4,
  },
  totalLabel: { fontSize: 13, fontWeight: "800", color: BrandColors.textMuted },
  totalValue: { fontSize: 16, fontWeight: "900", color: BrandColors.textDark },
  bankSection: {
    marginTop: Space.md,
    padding: Space.md,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.accentSoft,
    borderWidth: 1,
    borderColor: BrandColors.border,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "stretch",
  },
  bankSectionLabel: { ...Typography.overline, color: BrandColors.primaryDark, marginBottom: Space.xs },
  bankSectionHint: { ...Typography.caption, color: BrandColors.textMuted, lineHeight: 18, marginBottom: Space.sm },
  bankMuted: { ...Typography.subhead, color: BrandColors.textMuted },
  bankWarn: { ...Typography.subhead, color: BrandColors.primaryDark, lineHeight: 20 },
  bankRows: { gap: 0 },
  bankRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.surfaceMuted,
  },
  bankKey: { fontSize: 12, fontWeight: "700", color: BrandColors.textMuted },
  bankVal: { fontSize: 12, fontWeight: "800", color: BrandColors.textDark, maxWidth: "58%", textAlign: "right" },
  note: {
    marginTop: Space.md,
    color: BrandColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});

