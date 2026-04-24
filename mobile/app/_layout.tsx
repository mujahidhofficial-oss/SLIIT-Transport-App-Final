import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

LogBox.ignoreLogs([
  'VirtualizedLists should never be nested inside plain ScrollViews with the same orientation',
]);

export const unstable_settings = {
  // Default route is controlled by `app/index.tsx` (redirects to `/splash`)
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="splash" />
        <Stack.Screen name="loading" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        {/* Booking + trip flow */}
        <Stack.Screen name="booking" />
        <Stack.Screen name="seat-selection" />
        <Stack.Screen name="order-processing" />
        <Stack.Screen name="payment-method" />
        <Stack.Screen name="payment-success" />
        {/* Driver onboarding + uploads */}
        <Stack.Screen name="file-submissions" />
        <Stack.Screen name="driver-create-trip" />
        <Stack.Screen name="driver-booking-requests" />
        <Stack.Screen name="driver-ride-requests" />
        <Stack.Screen name="driver-active-trip" />
        <Stack.Screen name="driver-profile" />
        <Stack.Screen name="driver-bank-details" />
        <Stack.Screen name="driver-earnings" />
        <Stack.Screen name="driver-submit-bids" />
        <Stack.Screen name="driver-trip-action" />
        <Stack.Screen name="ride-request" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
