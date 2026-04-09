import { Redirect } from "expo-router";

/** Driver profile lives on the Driver tab; keep route for old links/deep links. */
export default function DriverProfileRedirect() {
  return <Redirect href="/(tabs)/explore" />;
}
