import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@sliit_transport_driver_session";

export type DriverSession = {
  driverId: string;
  email: string;
  fullName: string;
};

export async function getDriverSession(): Promise<DriverSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverSession;
    if (!parsed?.driverId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setDriverSession(session: DriverSession): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export async function clearDriverSession(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
