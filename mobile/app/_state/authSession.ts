import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@sliit_transport_auth_session";

export type AuthUser = {
  id: string;
  studentId?: string;
  email: string;
  role: "student" | "driver" | "admin";
  profile?: Record<string, unknown>;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export async function getAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setAuthSession(session: AuthSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
