import { Platform } from "react-native";
import Constants from "expo-constants";

function getExpoHostIp(): string | null {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ??
    (Constants as any)?.manifest2?.extra?.expoClient?.hostUri ??
    (Constants as any)?.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== "string") return null;
  return hostUri.split(":")[0] || null;
}

export function getApiBaseUrl() {
  // Backend for this project (letgo-driver-module) runs on port 5000.
  // - Android emulator: `10.0.2.2` -> dev machine
  // - iOS simulator (usually): `localhost`
  //
  // Allow platform-specific overrides too:
  // - EXPO_PUBLIC_API_URL
  // - EXPO_PUBLIC_API_URL_ANDROID
  // - EXPO_PUBLIC_API_URL_IOS
  const globalUrl = process.env.EXPO_PUBLIC_API_URL;
  const androidUrl = process.env.EXPO_PUBLIC_API_URL_ANDROID;
  const iosUrl = process.env.EXPO_PUBLIC_API_URL_IOS;
  const webUrl = process.env.EXPO_PUBLIC_API_URL_WEB;

  const fallbackAndroid = "http://10.0.2.2:5000";
  const fallbackIos = "http://localhost:5000";
  const fallbackWeb = "http://localhost:5000";

  if (globalUrl) return globalUrl;

  // On physical devices, localhost points to the device itself.
  // Derive the dev machine IP from Expo host and use that first.
  const hostIp = getExpoHostIp();
  if (hostIp) return `http://${hostIp}:5000`;

  if (Platform.OS === "android") return androidUrl ?? fallbackAndroid;
  if (Platform.OS === "ios") return iosUrl ?? fallbackIos;
  return webUrl ?? fallbackWeb;
}

/** Returned by GET /api/drivers/:driverId/bank-details (no auth). */
export type DriverBankDetailsPublic = {
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  driverFullName: string;
  hasBankDetails: boolean;
};

export async function fetchDriverBankDetails(
  apiBaseUrl: string,
  driverId: string
): Promise<DriverBankDetailsPublic> {
  const id = String(driverId ?? "").trim();
  if (!id) {
    return {
      bankAccountName: "",
      bankName: "",
      bankAccountNumber: "",
      bankBranch: "",
      driverFullName: "",
      hasBankDetails: false,
    };
  }
  const res = await fetch(`${apiBaseUrl}/api/drivers/${encodeURIComponent(id)}/bank-details`);
  const body = (await res.json().catch(() => ({}))) as Partial<DriverBankDetailsPublic> & { message?: string };
  if (!res.ok) {
    throw new Error(typeof body?.message === "string" ? body.message : "Failed to load bank details");
  }
  return {
    bankAccountName: String(body.bankAccountName ?? ""),
    bankName: String(body.bankName ?? ""),
    bankAccountNumber: String(body.bankAccountNumber ?? ""),
    bankBranch: String(body.bankBranch ?? ""),
    driverFullName: String(body.driverFullName ?? ""),
    hasBankDetails: !!body.hasBankDetails,
  };
}

