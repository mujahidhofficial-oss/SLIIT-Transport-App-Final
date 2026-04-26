import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenShell } from "@/app/_components/ui/ScreenShell";
import { ScreenHeader } from "@/app/_components/ui/ScreenHeader";
import { AppCard } from "@/app/_components/ui/AppCard";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { ProfileAvatar } from "@/app/_components/ProfileAvatar";
import { BrandColors } from "@/app/_theme/colors";
import { Radii, Space, Typography } from "@/app/_theme/tokens";
import { type DriverBankDetailsPublic, fetchDriverBankDetails, getApiBaseUrl } from "@/app/_state/api";
import { getAuthSession } from "@/app/_state/authSession";

type MethodKey = "cash" | "bank";

function parseMoneyParam(s: string) {
  const n = Number(String(s ?? "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

function MethodRow({
  title,
  subtitle,
  icon,
  active,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.methodRow, active && styles.methodRowActive]}>
      <View style={styles.methodIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.methodTitle}>{title}</Text>
        <Text style={styles.methodSub}>{subtitle}</Text>
      </View>
      <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
        {active ? <View style={styles.radioInner} /> : null}
      </View>
    </Pressable>
  );
}

export default function PaymentMethodScreen() {
  const params = useLocalSearchParams<{
    ref?: string;
    total?: string;
    tripDescription?: string;
    tipDescription?: string;
    basicClassification?: string;
    subcategory?: string;
    amount?: string;
    adminFee?: string;
    driverId?: string;
    requestId?: string;
  }>();

  const referenceCode = params.ref ?? "REF-000000-000";
  const total = params.total ?? "0.00";
  const trip = (params.tripDescription ?? "").trim();
  const tipDescription = (params.tipDescription ?? "").trim();
  const basicClassification = (params.basicClassification ?? "").trim();
  const subcategory = (params.subcategory ?? "").trim();
  const amount = params.amount ?? "0";
  const adminFee = params.adminFee ?? "0";
  const safeTrip = trip || "Campus transport payment";
  const safeClassification = basicClassification || "Transport";
  const safeSubcategory = subcategory || "Trip fare";
  const safeTip = tipDescription || "No additional notes";

  const [method, setMethod] = useState<MethodKey>("cash");
  const methodRef = useRef<MethodKey>("cash");
  methodRef.current = method;
  const [loading, setLoading] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [bankDetails, setBankDetails] = useState<DriverBankDetailsPublic | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiBaseUrl = getApiBaseUrl();
      let driverId = (params.driverId ?? "").trim();
      const requestId = (params.requestId ?? "").trim();
      const auth = await getAuthSession();
      const customerId = auth?.user?.id ? String(auth.user.id) : "demo-customer";
      if (!driverId && requestId && customerId !== "demo-customer") {
        try {
          const lookup = await fetch(
            `${apiBaseUrl}/api/ride-requests/${encodeURIComponent(requestId)}?customerId=${encodeURIComponent(customerId)}`
          );
          const lj = await lookup.json().catch(() => ({}));
          if (lookup.ok && lj?.driverId) driverId = String(lj.driverId).trim();
        } catch {
          /* ignore */
        }
      }
      if (!driverId) driverId = "demo-driver";
      setBankLoading(true);
      setBankError(null);
      try {
        const d = await fetchDriverBankDetails(apiBaseUrl, driverId);
        if (!cancelled) {
          setBankDetails(d);
          setBankError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setBankDetails(null);
          setBankError(e instanceof Error ? e.message : "Could not load bank details");
        }
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.driverId, params.requestId]);

  const subtitle = useMemo(() => {
    if (!trip) return `Reference ${referenceCode}`;
    return trip.length > 32 ? `${trip.slice(0, 32)}…` : trip;
  }, [referenceCode, trip]);

  const onPayNow = async () => {
    if (loading) return;
    const a = parseMoneyParam(amount);
    const f = parseMoneyParam(adminFee);
    const t = parseMoneyParam(total);
    const payIssues: string[] = [];
    if (a <= 0) payIssues.push("Amount must be greater than 0");
    if (f < 0) payIssues.push("Admin fee cannot be negative");
    if (a + f <= 0 || t <= 0) payIssues.push("Total must be greater than 0");
    if (payIssues.length > 0) {
      setValidationMessages(payIssues);
      return;
    }
    setValidationMessages([]);

    setLoading(true);

    try {
      const apiBaseUrl = getApiBaseUrl();
      const selectedMethod = methodRef.current;
      const backendMethod = selectedMethod === "bank" ? "cash" : "card";
      const auth = await getAuthSession();
      const customerId = auth?.user?.id ? String(auth.user.id) : "demo-customer";
      let driverId = (params.driverId ?? "").trim();
      const requestId = (params.requestId ?? "").trim();
      if (!driverId && requestId && customerId !== "demo-customer") {
        try {
          const lookup = await fetch(
            `${apiBaseUrl}/api/ride-requests/${encodeURIComponent(requestId)}?customerId=${encodeURIComponent(customerId)}`
          );
          const lj = await lookup.json().catch(() => ({}));
          if (lookup.ok && lj?.driverId) driverId = String(lj.driverId).trim();
        } catch {
          /* keep empty */
        }
      }
      if (!driverId) driverId = "demo-driver";

      const createRes = await fetch(`${apiBaseUrl}/api/payments/demo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceCode,
          tripDescription: safeTrip,
          tipDescription: safeTip,
          basicClassification: safeClassification,
          subcategory: safeSubcategory,
          amount,
          adminFee,
          total,
          paymentMethod: backendMethod,
          customerId,
          driverId,
          rideRequestId: requestId || undefined,
        }),
      });

      const createBody = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        throw new Error(createBody?.message || "Failed to create payment");
      }

      const paymentId = createBody?.payment?._id as string | undefined;
      if (!paymentId) throw new Error("Payment id missing from response");

      // UX rule:
      // - Cash payment -> direct success
      // - Bank transfer -> file submission, then success
      if (selectedMethod === "bank") {
        router.push({
          pathname: "/file-submissions",
          params: {
            paymentId,
            ref: referenceCode,
            total,
            method: "bank",
            driverId,
            requestId,
          },
        });
        return;
      }

      // Cash only: instant demo confirmation — no file submission step.
      await fetch(`${apiBaseUrl}/api/payments/demo/${paymentId}/confirm-card`, {
        method: "PUT",
      }).catch(() => null);

      router.replace({
        pathname: "/payment-success",
        params: {
          paymentId,
          ref: referenceCode,
          total,
          method: "cash",
          requestId,
          driverId,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      setValidationMessages([msg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell>
      <ScreenHeader title="Successfully Process" subtitle={subtitle} showBack />

      <View style={styles.topRow}>
        <ProfileAvatar size={46} />
        <View style={styles.badge}>
          <Ionicons name="receipt-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.badgeText}>{total}</Text>
        </View>
      </View>

      <AppCard style={styles.card} padded>
        <Text style={styles.sectionLabel}>Driver bank account</Text>
        <Text style={styles.bankIntro}>Use these details if you pay by bank transfer (also on the bill screen).</Text>
        <View style={[styles.bankCard, styles.bankCardInset]}>
          <View style={styles.bankHeader}>
            <Ionicons name="business-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.bankSectionTitle}>Pay to this account</Text>
          </View>
          {bankLoading ? (
            <Text style={styles.bankMuted}>Loading driver bank details…</Text>
          ) : bankError ? (
            <Text style={styles.bankWarn}>{bankError}</Text>
          ) : !bankDetails?.hasBankDetails ? (
            <Text style={styles.bankWarn}>
              This driver has not added bank details yet — use cash or confirm the account with the driver.
            </Text>
          ) : (
            <>
              {bankDetails.driverFullName ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Reference name</Text>
                  <Text style={styles.bankValue}>{bankDetails.driverFullName}</Text>
                </View>
              ) : null}
              {bankDetails.bankAccountName ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Account name</Text>
                  <Text style={styles.bankValue}>{bankDetails.bankAccountName}</Text>
                </View>
              ) : null}
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Bank</Text>
                <Text style={styles.bankValue}>{bankDetails.bankName}</Text>
              </View>
              {bankDetails.bankBranch ? (
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Branch</Text>
                  <Text style={styles.bankValue}>{bankDetails.bankBranch}</Text>
                </View>
              ) : null}
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>Account no.</Text>
                <Text style={styles.bankValue}>{bankDetails.bankAccountNumber}</Text>
              </View>
            </>
          )}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: Space.md }]}>Select payment method</Text>

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

        <MethodRow
          title="Cash payment"
          subtitle="Payment completed successfully (no file submission)"
          icon={<Ionicons name="cash-outline" size={22} color={BrandColors.primaryDark} />}
          active={method === "cash"}
          onPress={() => {
            setValidationMessages([]);
            setMethod("cash");
          }}
        />
        <MethodRow
          title="Bank Transfer"
          subtitle="Transfer to driver’s account, then upload slip"
          icon={<Ionicons name="swap-horizontal-outline" size={22} color={BrandColors.primaryDark} />}
          active={method === "bank"}
          onPress={() => {
            setValidationMessages([]);
            setMethod("bank");
          }}
        />

        <PrimaryButton title={loading ? "Processing..." : "Pay now"} onPress={onPayNow} style={{ marginTop: Space.lg }} disabled={loading} />
      </AppCard>

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

  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.md,
    borderRadius: Radii.lg,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    marginBottom: Space.sm,
  },
  methodRowActive: { borderColor: BrandColors.primary, backgroundColor: BrandColors.accentSoft },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  methodTitle: { fontSize: 15, fontWeight: "900", color: BrandColors.textDark },
  methodSub: { marginTop: 3, fontSize: 12, fontWeight: "600", color: BrandColors.textMuted },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BrandColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: { borderColor: BrandColors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: BrandColors.primary },

  bankIntro: { ...Typography.caption, color: BrandColors.textMuted, lineHeight: 18, marginBottom: Space.sm },
  bankCard: { backgroundColor: BrandColors.accentSoft, borderWidth: 1, borderColor: BrandColors.border, borderRadius: Radii.md, padding: Space.md },
  bankCardInset: { marginTop: 0 },
  bankHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Space.sm },
  bankSectionTitle: { fontSize: 13, fontWeight: "900", color: BrandColors.primaryDark },
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
  bankMuted: { ...Typography.subhead, color: BrandColors.textMuted },
  bankWarn: { ...Typography.subhead, color: BrandColors.primaryDark, lineHeight: 20 },

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

