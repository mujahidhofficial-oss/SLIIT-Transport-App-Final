import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons, MaterialIcons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { BrandColors } from "@/app/_theme/colors";
import { Elevated, Layout, Radii, ScreenBg, Space, Typography } from "@/app/_theme/tokens";
import { PrimaryButton } from "@/app/_components/PrimaryButton";
import { AuthBackdrop } from "@/app/_components/illustrations/AuthBackdrop";
import { BottomWave } from "@/app/_components/illustrations/BottomWave";
import { getApiBaseUrl } from "@/app/_state/api";
import { setDriverSession } from "@/app/_state/driverSession";
import { setAuthSession, type AuthUser } from "@/app/_state/authSession";

function validateLoginFields(email: string, password: string): string[] {
  const errs: string[] = [];
  const e = email.trim();
  if (!e) errs.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errs.push("Enter a valid email address");
  if (!password) errs.push("Password is required");
  return errs;
}

type TabKey = "login" | "signup" | "driver";

function normalizeTab(value: unknown): TabKey {
  if (value === "signup" || value === "driver" || value === "login") return value;
  return "login";
}

export default function Auth() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = useMemo(() => normalizeTab(params.tab), [params.tab]);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [showPw, setShowPw] = useState(false);
  /** Hide hero while typing so the form moves up and stays above the keyboard (PickMe-style). */
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const s = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const heroLayout = useMemo(() => {
    const sidePad = Space.md * 2 + 8;
    const maxCap = 300;
    const maxD = Math.min(windowWidth - sidePad, maxCap);
    const size = Math.round(Math.max(232, Math.min(maxD, maxCap)));
    const img = Math.round(size * 0.918);
    const ringInset = Math.max(10, Math.round(size * 0.05));
    return { size, img, ringInset };
  }, [windowWidth]);

  const title =
    tab === "login" ? "Login" : tab === "signup" ? "Create an account" : "Driver registration";
  const subtitle =
    tab === "login"
      ? "Sign in with your SLIIT Go account"
      : tab === "signup"
        ? "Join as a passenger — book rides and view history"
        : "Register to publish trips and accept requests";

  return (
    <View style={styles.bg}>
      <View style={styles.backdrop} pointerEvents="none">
        <AuthBackdrop />
      </View>
      <View style={styles.layer} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 6 : 0}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator
            contentContainerStyle={[
              styles.authScrollContent,
              keyboardOpen && styles.authScrollContentKeyboard,
            ]}
            nestedScrollEnabled
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          >
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={24} color={BrandColors.primaryDark} />
              </TouchableOpacity>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.tabsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsRow}
              >
                <TabLabel active={tab === "login"} onPress={() => setTab("login")} title="Login" />
                <TabLabel active={tab === "signup"} onPress={() => setTab("signup")} title="Sign up" />
                <TabLabel active={tab === "driver"} onPress={() => setTab("driver")} title="Driver" />
              </ScrollView>
            </View>

            {!keyboardOpen ? (
              <View style={styles.authHeroWrap}>
                <View
                  style={[
                    styles.authHeroOuter,
                    {
                      width: heroLayout.size,
                      height: heroLayout.size,
                      borderRadius: heroLayout.size / 2,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={["#F2FCFD", "#BEEFF3", "#A5F2F3"]}
                    locations={[0, 0.42, 1]}
                    start={{ x: 0.15, y: 0 }}
                    end={{ x: 0.85, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={[styles.authHeroInnerRing, { margin: heroLayout.ringInset }]} />
                  <Image
                    source={require("../../assets/images/auth-astronaut-hero.png")}
                    style={[
                      styles.authHeroImage,
                      { width: heroLayout.img, height: heroLayout.img },
                    ]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    accessibilityLabel="Illustration of a driver in a red car"
                  />
                </View>
                <Text style={styles.authHeroCaption} numberOfLines={2}>
                  {tab === "login"
                    ? "Welcome back — find rides when you need them"
                    : tab === "signup"
                      ? "Create an account — book campus & city rides"
                      : "Driver registration — share your route with passengers"}
                </Text>
              </View>
            ) : (
              <View style={styles.authHeroCollapsed} accessibilityElementsHidden>
                <Text style={styles.authHeroCollapsedText} numberOfLines={1}>
                  {tab === "login" ? "Login" : tab === "signup" ? "Sign up" : "Driver"} — fill the form below
                </Text>
              </View>
            )}

            {tab === "login" ? (
              <LoginForm showPw={showPw} onTogglePw={() => setShowPw((s) => !s)} />
            ) : tab === "signup" ? (
              <SignupForm showPw={showPw} onTogglePw={() => setShowPw((s) => !s)} />
            ) : (
              <DriverForm showPw={showPw} onTogglePw={() => setShowPw((s) => !s)} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <View style={styles.waveWrap} pointerEvents="none">
        <BottomWave color={BrandColors.sky} />
      </View>
    </View>
  );
}

function TabLabel({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tabPill,
        active && styles.tabPillActive,
        pressed && styles.tabPillPressed,
      ]}
    >
      <Text style={[styles.tabPillText, !active && styles.tabTextInactive]}>{title}</Text>
    </Pressable>
  );
}

function FormSectionTitle({ children, first }: { children: string; first?: boolean }) {
  return <Text style={[styles.sectionTitle, first && styles.sectionTitleFirst]}>{children}</Text>;
}

function InputRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.inputRow}>
      {icon}
      {children}
    </View>
  );
}

function LoginForm({ showPw, onTogglePw }: { showPw: boolean; onTogglePw: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loginErrors, setLoginErrors] = useState<string[]>([]);

  useEffect(() => {
    setLoginErrors([]);
  }, [email, password]);

  const onLogin = async () => {
    if (loading) return;
    const fieldErrs = validateLoginFields(email, password);
    if (fieldErrs.length) {
      setLoginErrors(fieldErrs);
      return;
    }
    try {
      setLoading(true);
      setLoginErrors([]);
      const baseUrl = getApiBaseUrl();
      const emailNorm = email.trim().toLowerCase();
      const passwordNorm = password.trim();
      let res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm, password: passwordNorm }),
      });
      let body = (await res.json().catch(() => ({}))) as {
        message?: string;
        token?: string;
        user?: { id: string; studentId?: string; email: string; role: "student" | "driver" | "admin"; profile?: any };
        driver?: { id: string; email: string; fullName: string };
      };

      const authSucceeded = res.ok && Boolean(body.token && body.user);

      // Passenger and driver accounts live in different API collections. If auth login
      // did not return a session, try driver login — unless the email exists but the
      // password is wrong (avoid confusing double errors).
      if (!authSucceeded) {
        const authMsg = String(body.message ?? "");
        if (/incorrect password/i.test(authMsg)) {
          throw new Error(authMsg || "Incorrect password");
        }
        const driverRes = await fetch(`${baseUrl}/api/drivers/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailNorm, password: passwordNorm }),
        });
        const driverBody = (await driverRes.json().catch(() => ({}))) as typeof body;
        if (driverRes.ok && driverBody.token && driverBody.user) {
          res = driverRes;
          body = driverBody;
        } else {
          const hint =
            driverBody.message && driverBody.message !== body.message
              ? `${body.message ?? "Login failed"}. (${driverBody.message})`
              : body.message ?? driverBody.message ?? "Login failed";
          throw new Error(hint);
        }
      }

      if (!res.ok || !body.token || !body.user) {
        throw new Error(body.message ?? "Login failed");
      }
      await setAuthSession({ token: body.token, user: body.user });
      if (body.user.role === "driver") {
        await setDriverSession({
          driverId: body.user.id,
          email: body.user.email,
          fullName: String(body.user.profile?.fullName ?? body.driver?.fullName ?? ""),
        });
      }
      router.replace("/(tabs)");
    } catch (e) {
      setLoginErrors([e instanceof Error ? e.message : "Unable to login"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formWrap}>
      <InputRow icon={<MaterialIcons name="email" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Email Address"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </InputRow>

      <InputRow icon={<Ionicons name="lock-closed" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Password"
          placeholderTextColor={BrandColors.textLight}
          secureTextEntry={!showPw}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={onTogglePw}>
          <Feather name={showPw ? "eye" : "eye-off"} size={18} color={BrandColors.textLight} />
        </TouchableOpacity>
      </InputRow>

      <View style={styles.row2}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.checkRow}
          onPress={() => setRemember((v) => !v)}
        >
          <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
            {remember && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
          </View>
          <Text style={styles.remember}>Remember the password</Text>
        </TouchableOpacity>
        <Text style={styles.forgot}>Forgot your password</Text>
      </View>

      {loginErrors.length > 0 ? (
        <View style={[styles.driverValidationBox, { marginTop: Space.sm }]} accessibilityLiveRegion="polite">
          <Text style={styles.driverValidationTitle}>Please fix the following</Text>
          {loginErrors.map((line, i) => (
            <Text key={`${line}-${i}`} style={styles.driverValidationLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      <PrimaryButton
        title={loading ? "Logging in..." : "Login"}
        onPress={() => void onLogin()}
        style={{ marginTop: 16 }}
        disabled={loading}
      />

      <Text style={styles.small}>Registration through social media</Text>
      <View style={styles.socialRow}>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-facebook" size={24} color={BrandColors.white} />
        </View>
        <View style={[styles.socialCircle, { backgroundColor: "#FFFFFF" }]}>
          <Ionicons name="logo-google" size={22} color={BrandColors.primary} />
        </View>
        <View style={styles.socialCircle}>
          <Ionicons name="logo-apple" size={26} color={BrandColors.white} />
        </View>
      </View>

      <View style={styles.fpWrap}>
        <View style={styles.fingerprintBox}>
          <MaterialCommunityIcons name="fingerprint" size={48} color={BrandColors.white} />
        </View>
        <Text style={styles.fpText}>Log in using your fingerprint</Text>
      </View>
    </View>
  );
}

function SignupForm({ showPw, onTogglePw }: { showPw: boolean; onTogglePw: () => void }) {
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (loading) return;
    if (!studentId.trim() || !email.trim() || !password || !fullName.trim() || !phone.trim()) {
      Alert.alert("Check fields", "Please fill student ID, email, password, name, and phone.");
      return;
    }
    try {
      setLoading(true);
      const registerRes = await fetch(`${getApiBaseUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: studentId.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "student",
          profile: { fullName: fullName.trim(), phone: phone.trim() },
        }),
      });
      const registerBody = (await registerRes.json().catch(() => ({}))) as { message?: string };
      if (!registerRes.ok) {
        throw new Error(registerBody.message ?? "Registration failed");
      }

      const loginRes = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const loginBody = (await loginRes.json().catch(() => ({}))) as {
        message?: string;
        token?: string;
        user?: { id: string; studentId?: string; email: string; role: "student" | "driver" | "admin"; profile?: any };
      };
      if (!loginRes.ok || !loginBody.token || !loginBody.user) {
        throw new Error(loginBody.message ?? "Login after signup failed");
      }
      await setAuthSession({ token: loginBody.token, user: loginBody.user });
      router.replace("/(tabs)");
    } catch (e) {
      Alert.alert("Sign up failed", e instanceof Error ? e.message : "Unable to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formWrap}>
      <Text style={styles.formLead}>
        Create your passenger account — book trips and view history in one place.
      </Text>

      <FormSectionTitle first>Account</FormSectionTitle>
      <InputRow icon={<Ionicons name="id-card-outline" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Student ID"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={studentId}
          onChangeText={setStudentId}
        />
      </InputRow>
      <InputRow icon={<MaterialIcons name="email" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Email"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </InputRow>

      <InputRow icon={<Ionicons name="lock-closed" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Password (min. 6 characters)"
          placeholderTextColor={BrandColors.textLight}
          secureTextEntry={!showPw}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={onTogglePw}>
          <Feather name={showPw ? "eye" : "eye-off"} size={18} color={BrandColors.textLight} />
        </TouchableOpacity>
      </InputRow>

      <FormSectionTitle>Your details</FormSectionTitle>
      <InputRow icon={<Ionicons name="person" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Full name"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
        />
      </InputRow>

      <InputRow icon={<Ionicons name="call" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Mobile (e.g. 94771234567)"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </InputRow>

      <PrimaryButton
        title={loading ? "Creating account..." : "Create account"}
        onPress={() => void onSubmit()}
        style={{ marginTop: Space.lg }}
        disabled={loading}
      />
    </View>
  );
}

type PickedLicense = { uri: string; name: string; mimeType?: string };
const DRIVER_VEHICLE_TYPES = ["Car", "Minivan", "Tuk Tuk", "Bicycle"] as const;

function validateDriverSignup(input: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  licenseNumber: string;
  licenseCategory: string;
  licenseExpiry: string;
  vehicleNumber: string;
  vehicleType: string;
  licenseFile: PickedLicense | null;
  vehicleBookFile: PickedLicense | null;
  vehiclePhotoFile: PickedLicense | null;
}): string[] {
  const errs: string[] = [];
  const em = input.email.trim();
  if (!em) errs.push("Email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(em)) errs.push("Enter a valid email address");
  if (!input.password) errs.push("Password is required");
  else if (input.password.length < 6) errs.push("Password must be at least 6 characters");
  if (!input.fullName.trim()) errs.push("Full name is required");
  if (!input.phone.trim()) errs.push("Mobile number is required");
  if (!input.licenseNumber.trim()) errs.push("Driving license number is required");
  if (!input.licenseCategory.trim()) errs.push("License class is required (e.g. B1)");
  if (!input.licenseExpiry.trim()) errs.push("License expiry is required (YYYY-MM-DD)");
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.licenseExpiry.trim())) errs.push("Expiry must be in YYYY-MM-DD format");
  if (!input.vehicleNumber.trim()) errs.push("Vehicle registration is required");
  if (!input.vehicleType.trim()) errs.push("Select your vehicle type");
  if (!input.vehicleBookFile) errs.push("Add a clear JPG or PNG photo of your vehicle book (library or camera)");
  if (!input.vehiclePhotoFile) errs.push("Add a clear JPG or PNG photo of your vehicle (library or camera)");
  if (!input.licenseFile) errs.push("Add a clear JPG or PNG photo of your license (library or camera)");
  return errs;
}

function DriverForm({ showPw, onTogglePw }: { showPw: boolean; onTogglePw: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseCategory, setLicenseCategory] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseFile, setLicenseFile] = useState<PickedLicense | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleBookFile, setVehicleBookFile] = useState<PickedLicense | null>(null);
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<PickedLicense | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationMessages, setValidationMessages] = useState<string[]>([]);
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [verifyBanner, setVerifyBanner] = useState<string | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [verifyVehicleToken, setVerifyVehicleToken] = useState<string | null>(null);
  const [verifyVehicleBanner, setVerifyVehicleBanner] = useState<string | null>(null);
  const [vehicleCheckLoading, setVehicleCheckLoading] = useState(false);
  const autoVehicleCheckKeyRef = useRef("");

  /** iPhone often returns HEIC; our API only accepts JPG/PNG/WEBP — convert before upload. */
  const normalizeLicenseAsset = async (
    asset: ImagePicker.ImagePickerAsset
  ): Promise<PickedLicense | null> => {
    const name = asset.fileName ?? "";
    const mime = (asset.mimeType ?? "").toLowerCase();
    const uriLower = String(asset.uri ?? "").toLowerCase();
    const isHeic =
      mime.includes("heic") ||
      mime.includes("heif") ||
      /\.hei[cf]$/i.test(name) ||
      uriLower.includes(".heic") ||
      uriLower.includes(".heif");

    if (isHeic) {
      try {
        const out = await ImageManipulator.manipulateAsync(asset.uri, [], {
          compress: 0.88,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        return { uri: out.uri, name: "license.jpg", mimeType: "image/jpeg" };
      } catch {
        Alert.alert(
          "Could not use this photo",
          "iPhone HEIC photos must be converted. Try again or take a new picture with the camera."
        );
        return null;
      }
    }

    const fallbackMime = mime || "image/jpeg";
    if (!fallbackMime.startsWith("image/")) {
      Alert.alert("Unsupported file", "Use a JPG or PNG photo of your license for verification.");
      return null;
    }
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    return {
      uri: asset.uri,
      name: name || `license.${ext}`,
      mimeType: fallbackMime,
    };
  };

  const pickLicenseFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to attach your license.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88,
        allowsMultipleSelection: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setLicenseFile(normalized);
        setValidationMessages([]);
        setVerifyToken(null);
        setVerifyBanner(null);
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const pickLicenseFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow camera access to photograph your license.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.88,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setLicenseFile(normalized);
        setValidationMessages([]);
        setVerifyToken(null);
        setVerifyBanner(null);
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const pickVehicleBookFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to attach your vehicle book.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88,
        allowsMultipleSelection: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setVehicleBookFile({ ...normalized, name: normalized.name || "vehicle-book.jpg" });
        setValidationMessages([]);
        setVerifyVehicleToken(null);
        setVerifyVehicleBanner(null);
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const pickVehicleBookFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow camera access to photograph your vehicle book.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.88,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setVehicleBookFile({ ...normalized, name: normalized.name || "vehicle-book.jpg" });
        setValidationMessages([]);
        setVerifyVehicleToken(null);
        setVerifyVehicleBanner(null);
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const pickVehiclePhotoFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow photo library access to attach your vehicle photo.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.88,
        allowsMultipleSelection: false,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setVehiclePhotoFile({ ...normalized, name: normalized.name || "vehicle.jpg" });
        setValidationMessages([]);
      }
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const pickVehiclePhotoFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Allow camera access to photograph your vehicle.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.88,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const normalized = await normalizeLicenseAsset(asset);
      if (normalized) {
        setVehiclePhotoFile({ ...normalized, name: normalized.name || "vehicle.jpg" });
        setValidationMessages([]);
      }
    } catch {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const checkLicenseMatch = async () => {
    if (!licenseNumber.trim()) {
      Alert.alert("License number", "Type your license number first.");
      return;
    }
    if (!licenseFile) {
      Alert.alert("Photo", "Add a license photo first (Gallery or Camera).");
      return;
    }
    setCheckLoading(true);
    setVerifyBanner(null);
    try {
      const baseUrl = getApiBaseUrl();
      const form = new FormData();
      form.append("licenseNumber", licenseNumber.trim());
      form.append("licenseImage", {
        uri: licenseFile.uri,
        name: licenseFile.name || "license.jpg",
        type: licenseFile.mimeType || "image/jpeg",
      } as unknown as Blob);
      const res = await fetch(`${baseUrl}/api/drivers/verify-license`, { method: "POST", body: form });
      const raw = await res.text().catch(() => "");
      let body: {
        message?: string;
        verifyToken?: string;
        typedNormalized?: string;
        scannedHint?: string;
        scannedLicenseNumber?: string;
        licenseOcrSkipped?: boolean;
      } = {};
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        body = { message: raw };
      }
      if (!res.ok) {
        setVerifyToken(null);
        let detail = body.message ?? raw.slice(0, 240) ?? `Check failed (${res.status})`;
        if (body.scannedLicenseNumber) {
          detail += `\n\n(Detected on photo: “${body.scannedLicenseNumber}” — fix the typed number or retake the photo.)`;
        }
        Alert.alert("License check failed", detail);
        return;
      }
      if (body.licenseOcrSkipped) {
        setVerifyToken(null);
        setVerifyBanner(
          String(body.message ?? "Server has OCR off — registration will be fast; photo is not compared here.")
        );
        return;
      }
      if (body.verifyToken) {
        setVerifyToken(body.verifyToken);
        const typed = body.typedNormalized ?? licenseNumber.trim();
        const hint = body.scannedHint ? ` Photo text hint: “${body.scannedHint}”.` : "";
        setVerifyBanner(
          `✓ Number “${typed}” matches the license photo.${hint} Finish registering within 15 minutes — you won’t upload the photo again.`
        );
      }
    } catch {
      Alert.alert("Error", "Could not reach the server to verify the license.");
    } finally {
      setCheckLoading(false);
    }
  };

  const checkVehicleBookMatch = useCallback(async (silent = false) => {
    if (!vehicleNumber.trim()) {
      if (!silent) Alert.alert("Vehicle number", "Type your vehicle number first.");
      return;
    }
    if (!vehicleBookFile) {
      if (!silent) Alert.alert("Photo", "Add a vehicle book photo first (Gallery or Camera).");
      return;
    }
    setVehicleCheckLoading(true);
    setVerifyVehicleBanner(null);
    try {
      const baseUrl = getApiBaseUrl();
      const form = new FormData();
      form.append("vehicleNumber", vehicleNumber.trim());
      form.append("vehicleBookImage", {
        uri: vehicleBookFile.uri,
        name: vehicleBookFile.name || "vehicle-book.jpg",
        type: vehicleBookFile.mimeType || "image/jpeg",
      } as unknown as Blob);
      const res = await fetch(`${baseUrl}/api/drivers/verify-vehicle-book`, { method: "POST", body: form });
      const raw = await res.text().catch(() => "");
      let body: {
        message?: string;
        verifyVehicleToken?: string;
        typedNormalized?: string;
        scannedHint?: string;
        scannedVehicleNumber?: string;
        vehicleBookOcrSkipped?: boolean;
      } = {};
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        body = { message: raw };
      }
      if (!res.ok) {
        setVerifyVehicleToken(null);
        let detail = body.message ?? raw.slice(0, 240) ?? `Check failed (${res.status})`;
        if (body.scannedVehicleNumber) {
          detail += `\n\n(Detected on photo: “${body.scannedVehicleNumber}” — fix the typed number or retake the photo.)`;
        }
        if (silent) {
          setVerifyVehicleBanner("Vehicle book check failed. Recheck vehicle number or retake the book photo.");
        } else {
          Alert.alert("Vehicle book check failed", detail);
        }
        return;
      }
      if (body.vehicleBookOcrSkipped) {
        setVerifyVehicleToken("ocr-skipped");
        setVerifyVehicleBanner(
          String(body.message ?? "Server has vehicle OCR off — registration will continue without image comparison.")
        );
        return;
      }
      if (body.verifyVehicleToken) {
        setVerifyVehicleToken(body.verifyVehicleToken);
        const typed = body.typedNormalized ?? vehicleNumber.trim();
        const hint = body.scannedHint ? ` Photo text hint: “${body.scannedHint}”.` : "";
        setVerifyVehicleBanner(
          `✓ Vehicle number “${typed}” matches the vehicle book photo.${hint} Finish registering within 15 minutes.`
        );
      }
    } catch {
      if (!silent) Alert.alert("Error", "Could not reach the server to verify the vehicle book.");
    } finally {
      setVehicleCheckLoading(false);
    }
  }, [vehicleNumber, vehicleBookFile]);

  useEffect(() => {
    const vehicleNo = vehicleNumber.trim().toUpperCase();
    const vehicleBookUri = vehicleBookFile?.uri ?? "";
    if (!vehicleNo || !vehicleBookUri || verifyVehicleToken || vehicleCheckLoading || loading) return;
    const key = `${vehicleNo}::${vehicleBookUri}`;
    if (autoVehicleCheckKeyRef.current === key) return;
    autoVehicleCheckKeyRef.current = key;
    void checkVehicleBookMatch(true);
  }, [vehicleNumber, vehicleBookFile, verifyVehicleToken, vehicleCheckLoading, loading, checkVehicleBookMatch]);

  const onSubmit = async () => {
    if (loading) return;
    const issues = validateDriverSignup({
      email,
      password,
      fullName,
      phone,
      licenseNumber,
      licenseCategory,
      licenseExpiry,
      vehicleNumber,
      vehicleType,
      licenseFile,
      vehicleBookFile,
      vehiclePhotoFile,
    });
    if (issues.length > 0) {
      setValidationMessages(issues);
      return;
    }
    if (!verifyVehicleToken) {
      setValidationMessages([
        "Please tap “Check vehicle book & number” and wait for success before registering.",
      ]);
      return;
    }
    setValidationMessages([]);

    try {
      setLoading(true);
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/drivers/register`;
      const lf = licenseFile!;
      const form = new FormData();
      form.append("email", email.trim().toLowerCase());
      form.append("password", password);
      form.append("fullName", fullName.trim());
      form.append("phone", phone.trim());
      form.append("licenseNumber", licenseNumber.trim());
      form.append("licenseCategory", licenseCategory.trim());
      form.append("licenseExpiry", licenseExpiry.trim());
      form.append("vehicleNumber", vehicleNumber.trim());
      form.append("vehicleType", vehicleType.trim());
      if (verifyToken) {
        form.append("verifyToken", verifyToken);
      } else {
        form.append("licenseImage", {
          uri: lf.uri,
          name: lf.name || "license.jpg",
          type: lf.mimeType || "image/jpeg",
        } as unknown as Blob);
      }
      form.append("verifyVehicleToken", verifyVehicleToken);
      if (vehiclePhotoFile) {
        form.append("vehicleImage", {
          uri: vehiclePhotoFile.uri,
          name: vehiclePhotoFile.name || "vehicle.jpg",
          type: vehiclePhotoFile.mimeType || "image/jpeg",
        } as unknown as Blob);
      }

      const res = await fetch(url, {
        method: "POST",
        body: form,
      });

      const rawText = await res.text().catch(() => "");
      type DriverRegisterBody = {
        message?: string;
        token?: string;
        user?: AuthUser;
        scannedLicenseNumber?: string;
        driver?: { id: string; email: string; fullName: string; phone?: string };
      };
      let body: DriverRegisterBody;
      if (!rawText) {
        body = {};
      } else {
        try {
          body = JSON.parse(rawText) as DriverRegisterBody;
        } catch {
          body = { message: rawText };
        }
      }

      if (!res.ok) {
        const preview = rawText ? rawText.slice(0, 300) : "";
        let detail = body.message ?? preview ?? `Registration failed (${res.status}). URL: ${url}`;
        if (body.scannedLicenseNumber && res.status === 400) {
          detail += `\n\n(Detected on license: “${body.scannedLicenseNumber}” — try a clearer photo or fix the number you typed.)`;
        }
        throw new Error(detail);
      }

      if (body.token && body.user) {
        await setAuthSession({ token: body.token, user: body.user });
      }
      if (body.driver) {
        await setDriverSession({
          driverId: body.driver.id,
          email: body.driver.email,
          fullName: body.driver.fullName,
        });
      }

      Alert.alert("Account created", body.message ?? "License saved. You can now create trips as this driver.", [
        { text: "Continue", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Registration failed";
      // For network errors, there may be no response body; include URL for troubleshooting.
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/drivers/register`;
      Alert.alert("Error", `${msg}\nURL: ${url}`);
    } finally {
      setLoading(false);
    }
  };

  const vehicleVerificationReady = Boolean(
    vehicleNumber.trim() && vehiclePhotoFile && verifyVehicleToken
  );
  const licenseVerified = Boolean(verifyToken) || Boolean(verifyBanner && /ocr.+(off|disabled|not compared)/i.test(verifyBanner));
  const vehicleNumberEntered = Boolean(vehicleNumber.trim());
  const vehicleBookVerified = Boolean(verifyVehicleToken);
  const vehiclePhotoAdded = Boolean(vehiclePhotoFile);

  return (
    <View style={styles.formWrap}>
      <View style={styles.driverBanner}>
        <Ionicons name="car-outline" size={22} color={BrandColors.primaryDark} />
        <Text style={styles.driverBannerText}>
          Register as a driver to publish trips and accept booking requests from passengers.
        </Text>
      </View>

      {validationMessages.length > 0 ? (
        <View style={styles.driverValidationBox} accessibilityLiveRegion="polite">
          <Text style={styles.driverValidationTitle}>Please fix the following</Text>
          {validationMessages.map((line, i) => (
            <Text key={`${line}-${i}`} style={styles.driverValidationLine}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}

      <FormSectionTitle first>Account</FormSectionTitle>
      <InputRow icon={<MaterialIcons name="email" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Email"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </InputRow>

      <InputRow icon={<Ionicons name="lock-closed" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Password (min. 6 characters)"
          placeholderTextColor={BrandColors.textLight}
          secureTextEntry={!showPw}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={onTogglePw}>
          <Feather name={showPw ? "eye" : "eye-off"} size={18} color={BrandColors.textLight} />
        </TouchableOpacity>
      </InputRow>

      <FormSectionTitle>Personal</FormSectionTitle>
      <InputRow icon={<Ionicons name="person" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Full name"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
        />
      </InputRow>

      <InputRow icon={<Ionicons name="call" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Mobile (e.g. 94771234567)"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </InputRow>

      <FormSectionTitle>License & vehicle</FormSectionTitle>
      <Text style={styles.helperHint}>
        Enter your license number exactly as on the card, then add a clear photo. Tap “Check license & number” to see if
        the photo matches what you typed (first check can take ~1 minute). Then upload your vehicle book photo and tap
        “Check vehicle book & number”. Complete both checks before registration.
      </Text>
      <InputRow icon={<Ionicons name="card" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Driving license number"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={licenseNumber}
          onChangeText={(t) => {
            setLicenseNumber(t);
            setVerifyToken(null);
            setVerifyBanner(null);
          }}
        />
      </InputRow>

      <InputRow icon={<Ionicons name="ribbon-outline" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="License class (e.g. B1, B)"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={licenseCategory}
          onChangeText={setLicenseCategory}
          autoCapitalize="characters"
        />
      </InputRow>

      <InputRow icon={<Ionicons name="calendar-outline" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Expiry date (YYYY-MM-DD)"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={licenseExpiry}
          onChangeText={setLicenseExpiry}
        />
      </InputRow>

      <View style={styles.licenseUploadCard}>
        <View style={styles.licenseUploadHeader}>
          <Ionicons name="document-attach-outline" size={20} color={BrandColors.primaryDark} />
          <Text style={styles.licenseUploadTitle}>License photo (required)</Text>
        </View>
        <Text style={styles.licenseUploadSub}>
          JPG or PNG — number on the card must be readable. iPhone HEIC photos are converted to JPEG automatically.
        </Text>
        <View style={styles.licensePickRow}>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickLicenseFromLibrary()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="images-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Gallery</Text>
          </Pressable>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickLicenseFromCamera()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="camera-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Camera</Text>
          </Pressable>
        </View>
        {licenseFile ? (
          <Text style={styles.licensePickedName} numberOfLines={1}>
            Selected: {licenseFile.name}
          </Text>
        ) : null}
        <Pressable
          style={[styles.licenseCheckBtn, (checkLoading || loading) && styles.licenseCheckBtnDisabled]}
          onPress={() => void checkLicenseMatch()}
          disabled={checkLoading || loading}
          android_ripple={{ color: "#00000012" }}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.licenseCheckBtnText}>
            {checkLoading ? "Checking photo vs number… ~30–60s first time" : "Check license & number"}
          </Text>
        </Pressable>
        {verifyBanner ? (
          <View style={styles.verifyBanner} accessibilityRole="text">
            <Text style={styles.verifyBannerText}>{verifyBanner}</Text>
          </View>
        ) : null}
      </View>

      <InputRow icon={<Ionicons name="car" size={20} color={BrandColors.primary} />}>
        <TextInput
          placeholder="Vehicle registration (e.g. CAB-1234)"
          placeholderTextColor={BrandColors.textLight}
          style={styles.input}
          value={vehicleNumber}
          onChangeText={(t) => {
            setVehicleNumber(t);
            setVerifyVehicleToken(null);
            setVerifyVehicleBanner(null);
          }}
          autoCapitalize="characters"
        />
      </InputRow>

      <View style={styles.vehicleTypeWrap}>
        <Text style={styles.vehicleTypeLabel}>Vehicle type</Text>
        <View style={styles.vehicleTypeRow}>
          {DRIVER_VEHICLE_TYPES.map((type) => {
            const active = vehicleType === type;
            return (
              <Pressable
                key={type}
                onPress={() => setVehicleType(type)}
                style={[styles.vehicleTypeChip, active && styles.vehicleTypeChipActive]}
                android_ripple={{ color: "#00000012" }}
              >
                <Text style={[styles.vehicleTypeChipText, active && styles.vehicleTypeChipTextActive]}>{type}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.licenseUploadCard}>
        <View style={styles.licenseUploadHeader}>
          <Ionicons name="document-text-outline" size={20} color={BrandColors.primaryDark} />
          <Text style={styles.licenseUploadTitle}>Vehicle book photo (required)</Text>
        </View>
        <Text style={styles.licenseUploadSub}>
          Upload a clear vehicle book image with the registration number visible.
        </Text>
        <View style={styles.licensePickRow}>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickVehicleBookFromLibrary()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="images-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Gallery</Text>
          </Pressable>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickVehicleBookFromCamera()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="camera-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Camera</Text>
          </Pressable>
        </View>
        {vehicleBookFile ? (
          <Text style={styles.licensePickedName} numberOfLines={1}>
            Selected: {vehicleBookFile.name}
          </Text>
        ) : null}
        <Pressable
          style={[styles.licenseCheckBtn, (vehicleCheckLoading || loading) && styles.licenseCheckBtnDisabled]}
          onPress={() => void checkVehicleBookMatch()}
          disabled={vehicleCheckLoading || loading}
          android_ripple={{ color: "#00000012" }}
        >
          <Ionicons name="shield-checkmark-outline" size={18} color={BrandColors.primaryDark} />
          <Text style={styles.licenseCheckBtnText}>
            {vehicleCheckLoading ? "Checking vehicle book vs number…" : "Check vehicle book & number"}
          </Text>
        </Pressable>
        {verifyVehicleBanner ? (
          <View style={styles.verifyBanner} accessibilityRole="text">
            <Text style={styles.verifyBannerText}>{verifyVehicleBanner}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.licenseUploadCard}>
        <View style={styles.licenseUploadHeader}>
          <Ionicons name="car-sport-outline" size={20} color={BrandColors.primaryDark} />
          <Text style={styles.licenseUploadTitle}>Vehicle photo (required)</Text>
        </View>
        <Text style={styles.licenseUploadSub}>
          Upload a clear photo of your vehicle (front or side view).
        </Text>
        <View style={styles.licensePickRow}>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickVehiclePhotoFromLibrary()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="images-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Gallery</Text>
          </Pressable>
          <Pressable
            style={styles.licensePickBtn}
            onPress={() => void pickVehiclePhotoFromCamera()}
            android_ripple={{ color: "#00000012" }}
          >
            <Ionicons name="camera-outline" size={18} color={BrandColors.primaryDark} />
            <Text style={styles.licensePickBtnText}>Camera</Text>
          </Pressable>
        </View>
        {vehiclePhotoFile ? (
          <Text style={styles.licensePickedName} numberOfLines={1}>
            Selected: {vehiclePhotoFile.name}
          </Text>
        ) : null}
      </View>

      <View style={styles.verifyStatusCard}>
        <Text style={styles.verifyStatusTitle}>Verification status</Text>
        <View style={styles.verifyStatusRow}>
          <Text style={styles.verifyStatusLabel}>License check</Text>
          <Text style={[styles.verifyStatusValue, licenseVerified ? styles.verifyDone : styles.verifyPending]}>
            {licenseVerified ? "Verified" : "Pending"}
          </Text>
        </View>
        <View style={styles.verifyStatusRow}>
          <Text style={styles.verifyStatusLabel}>Vehicle number + book</Text>
          <Text style={[styles.verifyStatusValue, vehicleBookVerified ? styles.verifyDone : styles.verifyPending]}>
            {vehicleBookVerified ? "Verified" : vehicleNumberEntered ? "Checking/Pending" : "Pending"}
          </Text>
        </View>
        <View style={styles.verifyStatusRow}>
          <Text style={styles.verifyStatusLabel}>Vehicle photo</Text>
          <Text style={[styles.verifyStatusValue, vehiclePhotoAdded ? styles.verifyDone : styles.verifyPending]}>
            {vehiclePhotoAdded ? "Added" : "Pending"}
          </Text>
        </View>
      </View>

      <PrimaryButton
        title={
          loading
            ? verifyToken
              ? "Creating account…"
              : "Verifying license (OCR)… can take 10–40s the first time"
            : verifyToken
              ? "Register as driver (fast — photo already checked)"
              : "Register as driver"
        }
        onPress={() => void onSubmit()}
        disabled={loading || checkLoading || vehicleCheckLoading || !vehicleVerificationReady}
        style={{ marginTop: Space.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: ScreenBg.light },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.65 },
  layer: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.74)" },
  safe: { flex: 1 },
  keyboardAvoid: { flex: 1 },
  /** One vertical scroll: header + tabs + hero + form — avoids form hidden under hero / bottom wave. */
  authScrollContent: {
    paddingBottom: 160,
    flexGrow: 1,
  },
  authScrollContentKeyboard: {
    paddingBottom: 32,
  },
  authHeroCollapsed: {
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    marginBottom: Space.sm,
  },
  authHeroCollapsedText: {
    fontSize: 12,
    fontWeight: "700",
    color: BrandColors.textMuted,
    textAlign: "center",
  },

  header: {
    marginTop: Space.sm,
    paddingHorizontal: Layout.screenPaddingX - 2,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: Radii.md,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.55)",
    ...Elevated.soft,
  },
  headerText: { flex: 1, minWidth: 0, paddingTop: 2 },
  title: { ...Typography.title, color: BrandColors.primaryDark },
  subtitle: {
    marginTop: 6,
    ...Typography.subhead,
    color: BrandColors.textMuted,
    lineHeight: 19,
  },

  tabsContainer: {
    marginTop: Space.md,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
  },
  tabsRow: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    gap: Space.sm,
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 2,
  },
  authHeroWrap: {
    alignItems: "center",
    paddingHorizontal: Space.md,
    paddingTop: Space.xs,
    paddingBottom: Space.sm,
  },
  /** Base styles; width/height/borderRadius set from `useWindowDimensions` in `Auth`. */
  authHeroOuter: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#A5F2F3",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.98)",
    shadowColor: BrandColors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 7,
  },
  authHeroInnerRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(8, 94, 155, 0.1)",
    pointerEvents: "none",
  },
  authHeroImage: {
    zIndex: 2,
  },
  authHeroCaption: {
    marginTop: Space.md,
    ...Typography.subhead,
    fontWeight: "700",
    color: BrandColors.primaryDark,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: Space.lg,
  },
  tabPill: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: Radii.pill,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  tabPillActive: {
    backgroundColor: BrandColors.white,
    borderWidth: 1.5,
    borderColor: BrandColors.primary,
    ...Elevated.soft,
  },
  tabPillPressed: { opacity: 0.92 },
  tabPillText: { color: BrandColors.primaryDark, fontWeight: "800", fontSize: 14 },
  tabTextInactive: { color: BrandColors.textMuted },

  formLead: {
    ...Typography.subhead,
    lineHeight: 21,
    color: BrandColors.textMuted,
    marginBottom: Space.lg,
  },
  sectionTitle: {
    ...Typography.overline,
    color: BrandColors.primaryDark,
    marginTop: Space.md,
    marginBottom: Space.xs,
  },
  sectionTitleFirst: {
    marginTop: 0,
  },
  driverBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Space.sm,
    backgroundColor: BrandColors.accentSoft,
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
    borderWidth: 1,
    borderColor: BrandColors.border,
  },
  driverBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: BrandColors.textDark,
    fontWeight: "600",
  },
  driverValidationBox: {
    backgroundColor: "rgba(176, 0, 32, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(176, 0, 32, 0.35)",
    borderRadius: Radii.md,
    padding: Space.md,
    marginBottom: Space.sm,
  },
  driverValidationTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#B00020",
    marginBottom: Space.xs,
  },
  driverValidationLine: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.textDark,
    lineHeight: 18,
    marginTop: 2,
  },
  helperHint: {
    fontSize: 12,
    lineHeight: 17,
    color: BrandColors.textMuted,
    marginBottom: Space.sm,
    marginTop: Space.xs,
  },
  licenseUploadCard: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    padding: Space.md,
    marginTop: Space.sm,
    marginBottom: Space.sm,
    backgroundColor: BrandColors.surfaceMuted,
  },
  licenseUploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginBottom: 4,
  },
  licenseUploadTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: BrandColors.primaryDark,
  },
  licenseUploadSub: {
    fontSize: 11,
    color: BrandColors.textMuted,
    marginBottom: Space.sm,
  },
  licensePickRow: {
    flexDirection: "row",
    gap: Space.sm,
    marginBottom: Space.xs,
  },
  licensePickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: Space.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.accentSoft,
  },
  licensePickBtnText: { fontSize: 13, fontWeight: "800", color: BrandColors.primaryDark },
  licensePickedName: {
    fontSize: 11,
    fontWeight: "600",
    color: BrandColors.textMuted,
    marginTop: 4,
  },
  licenseCheckBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Space.sm,
    marginTop: Space.md,
    paddingVertical: 12,
    paddingHorizontal: Space.md,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.white,
  },
  licenseCheckBtnDisabled: { opacity: 0.55 },
  licenseCheckBtnText: { fontSize: 13, fontWeight: "800", color: BrandColors.primaryDark },
  verifyBanner: {
    marginTop: Space.sm,
    padding: Space.sm,
    borderRadius: Radii.md,
    backgroundColor: "rgba(25,169,116,0.12)",
    borderWidth: 1,
    borderColor: "rgba(25,169,116,0.35)",
  },
  verifyBannerText: { fontSize: 12, fontWeight: "700", color: BrandColors.success, lineHeight: 18 },
  verifyStatusCard: {
    borderWidth: 1,
    borderColor: BrandColors.border,
    borderRadius: Radii.md,
    padding: Space.md,
    marginTop: Space.sm,
    backgroundColor: BrandColors.white,
  },
  verifyStatusTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: BrandColors.primaryDark,
    marginBottom: Space.xs,
  },
  verifyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  verifyStatusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: BrandColors.textDark,
  },
  verifyStatusValue: {
    fontSize: 12,
    fontWeight: "800",
  },
  verifyDone: {
    color: BrandColors.success,
  },
  verifyPending: {
    color: BrandColors.textMuted,
  },
  vehicleTypeWrap: {
    marginTop: Space.sm,
    marginBottom: Space.sm,
  },
  vehicleTypeLabel: {
    ...Typography.overline,
    color: BrandColors.primaryDark,
    marginBottom: Space.xs,
  },
  vehicleTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.xs,
  },
  vehicleTypeChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceMuted,
  },
  vehicleTypeChipActive: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.accentSoft,
  },
  vehicleTypeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: BrandColors.textDark,
  },
  vehicleTypeChipTextActive: {
    color: BrandColors.primaryDark,
  },
  licenseDrop: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: BrandColors.primary,
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    alignItems: "center",
    gap: 6,
    backgroundColor: BrandColors.accentSoft,
  },
  licenseDropText: {
    fontSize: 12,
    fontWeight: "700",
    color: BrandColors.primaryDark,
    textAlign: "center",
  },
  formWrap: {
    marginTop: Space.md,
    marginHorizontal: Space.md,
    marginBottom: Space.lg,
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.xl,
    backgroundColor: BrandColors.white,
    borderRadius: Radii.xl + 4,
    maxWidth: Layout.contentMaxWidth,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "rgba(201, 211, 219, 0.5)",
    ...Elevated.card,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BrandColors.border,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 16, color: BrandColors.textDark },

  row2: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: BrandColors.border,
    borderRadius: Radii.sm,
    backgroundColor: BrandColors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: BrandColors.primaryDark, borderColor: BrandColors.primaryDark },
  remember: { color: BrandColors.textMuted, fontSize: 12, fontWeight: "600" },
  forgot: { color: BrandColors.primary, fontSize: 12, fontWeight: "700" },

  small: {
    textAlign: "center",
    marginTop: Space.lg,
    color: BrandColors.textMuted,
    ...Typography.caption,
  },
  socialRow: { flexDirection: "row", justifyContent: "center", marginTop: Space.sm, gap: Space.lg },
  socialCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    ...Elevated.soft,
  },

  fpWrap: { alignItems: "center", marginTop: Space.lg },
  fingerprintBox: {
    width: 72,
    height: 72,
    borderRadius: Radii.lg,
    backgroundColor: BrandColors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    ...Elevated.soft,
  },
  fpText: { marginTop: Space.sm, color: BrandColors.textMuted, fontSize: 12, fontWeight: "600" },

  waveWrap: { position: "absolute", left: 0, right: 0, bottom: -12, alignItems: "center", opacity: 0.95 },
});

