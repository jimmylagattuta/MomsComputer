import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { useAuth } from "../../auth/AuthProvider";
import { postJson } from "../../services/api/client";
import {
  completeSignUp,
  requestPhoneCode,
  verifyPhoneCode,
} from "../../services/auth";
import { registerForPushNotificationsAsync } from "../../services/notifications";
import {
  getTextMomUnreadCount,
  refreshTextMomUnreadCountFromServer,
  subscribeToTextMomUnreadCount,
} from "../../services/notifications/textMomUnreadBadge";
import { linkRevenueCatCustomerAfterAuth } from "../../subscriptions/linkRevenueCatCustomer";
import {
  getCustomerInfo,
  isProActive,
  rcIdentifyUser,
  rcLogoutUser,
} from "../../subscriptions/rcClient";
import { useSubscription } from "../../subscriptions/useSubscription";
import HomeSettingsMenu from "./components/HomeSettingsMenu";

/**
 * ✅ DEV TOGGLES
 *
 * SUBSCRIPTIONS_ENABLED:
 * - true = RevenueCat/paywall logic is active
 * - false = subscription system is ignored completely
 *
 * DEV_PAYWALL_BYPASS:
 * - true = premium buttons open without paying
 * - false = normal paywall behavior
 *
 * Before TestFlight/App Store/real subscription testing:
 * set DEV_PAYWALL_BYPASS to false.
 */
const SUBSCRIPTIONS_ENABLED = true;
const DEV_PAYWALL_BYPASS = false;

/**
 * ✅ Instant access accounts
 *
 * These emails get premium access immediately without needing RevenueCat
 * or a backend subscription flag. Keep emails lowercase.
 */
const INSTANT_ACCESS_EMAILS = new Set([
  "jimmy.lagattuta@gmail.com",
]);

const IS_ANDROID = Platform.OS === "android";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  gold: "#D89A15",
  goldDark: "#8A5A00",
  goldSoft: "#FFF7E3",
  goldBorder: "#F5C96B",
};

const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1769703507/ChatGPT_Image_Jan_29_2026_08_00_07_AM_1_3_gtqeo8.jpg";

/**
 * ✅ Persisted Pro state so "Subscription active" only fires once per upgrade
 */
const PRO_STATE_KEY = (userId: string) => `rc_pro_state_v1:${userId}`;

/**
 * HomeScreen fail-safe:
 * If RevenueCat tells HomeScreen there is an active entitlement, remember it
 * locally so the visual gate immediately changes from PREMIUM to SETUP even
 * if the subscription hook is still catching up. This is cleared when a fresh
 * RevenueCat check returns no active entitlements.
 */
const HOME_RC_SEEN_PREMIUM_KEY = "momscomputer:home_rc_seen_premium_v1";

// Store "1" for pro, "0" for not pro
async function readStoredPro(userId: string): Promise<boolean | null> {
  try {
    const v = await SecureStore.getItemAsync(PRO_STATE_KEY(userId));
    if (v === "1") return true;
    if (v === "0") return false;
    return null;
  } catch {
    return null;
  }
}

async function writeStoredPro(userId: string, isPro: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(PRO_STATE_KEY(userId), isPro ? "1" : "0");
  } catch {
    // ignore
  }
}

async function readHomeRcSeenPremium(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(HOME_RC_SEEN_PREMIUM_KEY)) === "1";
  } catch {
    return false;
  }
}

async function writeHomeRcSeenPremium(isPremium: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(HOME_RC_SEEN_PREMIUM_KEY, isPremium ? "1" : "0");
  } catch {
    // ignore
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("auth_token");
  } catch {
    return null;
  }
}

async function hasNotificationPermission(): Promise<boolean> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status === "granted";
  } catch {
    return false;
  }
}


function norm(s: string) {
  return String(s || "").trim();
}

function normEmail(s: string) {
  return norm(s).toLowerCase();
}

function looksLikeEmail(email: string) {
  const e = normEmail(email);
  return /^\S+@\S+\.\S+$/.test(e);
}

function digitsOnly(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function formatPhoneDisplay(value: string) {
  const digits = digitsOnly(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;

  if (mins <= 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function friendlyAccountSetupError(message: string) {
  const msg = String(message || "").trim();
  if (msg) return msg;
  return "We couldn’t create your account right now. Please try again.";
}

function homeHasPremiumEntitlement(info: any): boolean {
  const active = info?.entitlements?.active ?? {};
  const activeKeys = Object.keys(active);

  // Primary source: your configured entitlement constant.
  if (isProActive(info)) return true;

  // Defensive fallback for launch/testing:
  // RevenueCat logs sometimes show both "pro" and "Mom’s Computer Pro".
  // If CustomerInfo has any active entitlement, treat HomeScreen as premium
  // so the UI switches from PREMIUM lock to account SETUP.
  if (activeKeys.length > 0) return true;

  return false;
}

function AnimatedHint() {
  const sheenX = useRef(new Animated.Value(-140)).current;
  const sheenOpacity = useRef(new Animated.Value(0)).current;

  const iconScale = useRef(new Animated.Value(0.92)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  const l1Opacity = useRef(new Animated.Value(0)).current;
  const l1Y = useRef(new Animated.Value(10)).current;
  const l1Scale = useRef(new Animated.Value(0.985)).current;

  const l2Opacity = useRef(new Animated.Value(0)).current;
  const l2Y = useRef(new Animated.Value(10)).current;
  const l2Scale = useRef(new Animated.Value(0.985)).current;

  const sequenceRef = useRef<Animated.CompositeAnimation | null>(null);

  useLayoutEffect(() => {
    let mounted = true;
    let raf1: number | null = null;
    let raf2: number | null = null;

    const reset = () => {
      sheenX.setValue(-140);
      sheenOpacity.setValue(0);

      iconScale.setValue(0.92);
      iconRotate.setValue(0);

      l1Opacity.setValue(0);
      l1Y.setValue(10);
      l1Scale.setValue(0.985);

      l2Opacity.setValue(0);
      l2Y.setValue(10);
      l2Scale.setValue(0.985);
    };

    const startOnce = () => {
      if (!mounted) return;

      sequenceRef.current?.stop();
      sequenceRef.current = null;

      reset();

      const seq = Animated.sequence([
        Animated.parallel([
          Animated.sequence([
            Animated.timing(sheenOpacity, {
              toValue: 1,
              duration: 220,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(sheenX, {
              toValue: 420,
              duration: 1200,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(sheenOpacity, {
              toValue: 0,
              duration: 260,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),

          Animated.sequence([
            Animated.delay(80),
            Animated.spring(iconScale, {
              toValue: 1,
              friction: 6,
              tension: 90,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(iconRotate, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(iconRotate, {
                toValue: -0.6,
                duration: 220,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(iconRotate, {
                toValue: 0,
                duration: 260,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),

          Animated.sequence([
            Animated.delay(260),
            Animated.parallel([
              Animated.timing(l1Opacity, {
                toValue: 1,
                duration: 520,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(l1Y, {
                toValue: 0,
                duration: 620,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.spring(l1Scale, {
                toValue: 1,
                friction: 9,
                tension: 85,
                useNativeDriver: true,
              }),
            ]),
          ]),

          Animated.sequence([
            Animated.delay(820),
            Animated.parallel([
              Animated.timing(l2Opacity, {
                toValue: 1,
                duration: 560,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(l2Y, {
                toValue: 0,
                duration: 660,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.spring(l2Scale, {
                toValue: 1,
                friction: 9,
                tension: 85,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]);

      sequenceRef.current = seq;
      seq.start(() => {});
    };

    if (Platform.OS === "ios") {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => startOnce());
      });
    } else {
      raf1 = requestAnimationFrame(() => startOnce());
    }

    return () => {
      mounted = false;
      if (raf1 != null) cancelAnimationFrame(raf1);
      if (raf2 != null) cancelAnimationFrame(raf2);

      sequenceRef.current?.stop();
      sequenceRef.current = null;

      sheenX.stopAnimation();
      sheenOpacity.stopAnimation();
      iconScale.stopAnimation();
      iconRotate.stopAnimation();
      l1Opacity.stopAnimation();
      l1Y.stopAnimation();
      l1Scale.stopAnimation();
      l2Opacity.stopAnimation();
      l2Y.stopAnimation();
      l2Scale.stopAnimation();
    };
  }, [
    iconRotate,
    iconScale,
    l1Opacity,
    l1Scale,
    l1Y,
    l2Opacity,
    l2Scale,
    l2Y,
    sheenOpacity,
    sheenX,
  ]);

  const rotateDeg = iconRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-10deg", "0deg", "10deg"],
  });

  return (
    <View style={styles.hintRow} pointerEvents="none">
      <View style={styles.hintCard}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.hintSheen,
            {
              opacity: sheenOpacity,
              transform: [{ translateX: sheenX }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.hintIcon,
            { transform: [{ scale: iconScale }, { rotate: rotateDeg }] },
          ]}
        >
          <Ionicons name="sparkles" size={14} color={BRAND.blue} />
        </Animated.View>

        <View style={styles.hintTextWrap}>
          <Animated.Text
            style={[
              styles.hintLinePrimary,
              {
                opacity: l1Opacity,
                transform: [{ translateY: l1Y }, { scale: l1Scale }],
              },
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            If something feels off…
          </Animated.Text>

          <Animated.Text
            style={[
              styles.hintLineSecondary,
              {
                opacity: l2Opacity,
                transform: [{ translateY: l2Y }, { scale: l2Scale }],
              },
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            Ask Mom first before you click
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

function PremiumPerch() {
  const glistenX = useRef(new Animated.Value(-42)).current;
  const glistenOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let mounted = true;

    const runGlisten = () => {
      if (!mounted) return;

      glistenX.setValue(-42);
      glistenOpacity.setValue(0);
      pulse.setValue(1);

      sequenceRef.current?.stop();

      sequenceRef.current = Animated.sequence([
        Animated.parallel([
          Animated.sequence([
            Animated.timing(glistenOpacity, {
              toValue: 0.9,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(glistenX, {
              toValue: 118,
              duration: 950,
              easing: Easing.inOut(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(glistenOpacity, {
              toValue: 0,
              duration: 220,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),

          Animated.sequence([
            Animated.delay(250),
            Animated.spring(pulse, {
              toValue: 1.025,
              friction: 8,
              tension: 70,
              useNativeDriver: true,
            }),
            Animated.spring(pulse, {
              toValue: 1,
              friction: 8,
              tension: 70,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]);

      sequenceRef.current.start(() => {
        if (!mounted) return;

        timeoutRef.current = setTimeout(() => {
          runGlisten();
        }, 2200);
      });
    };

    runGlisten();

    return () => {
      mounted = false;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      sequenceRef.current?.stop();
      sequenceRef.current = null;

      glistenX.stopAnimation();
      glistenOpacity.stopAnimation();
      pulse.stopAnimation();
    };
  }, [glistenOpacity, glistenX, pulse]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.premiumPerch,
        {
          transform: [{ scale: pulse }],
        },
      ]}
    >
      <View style={styles.premiumPerchInner}>
        <Animated.View
          style={[
            styles.premiumGlisten,
            {
              opacity: glistenOpacity,
              transform: [{ translateX: glistenX }, { rotate: "18deg" }],
            },
          ]}
        />

        <Text style={styles.premiumPerchText}>PREMIUM</Text>
      </View>
    </Animated.View>
  );
}


function AccountSetupPerch() {
  return (
    <View pointerEvents="none" style={styles.accountSetupPerch}>
      <View style={styles.accountSetupPerchInner}>
        <Ionicons name="person-add" size={10} color={BRAND.blue} />
        <Text style={styles.accountSetupPerchText}>SETUP</Text>
      </View>
    </View>
  );
}

type AccountSetupTarget = {
  featureName: string;
  route: string;
};

type AccountSetupModalProps = {
  visible: boolean;
  target: AccountSetupTarget | null;
  busy?: boolean;
  onCancel: () => void;
  onCompleted: (user: any) => Promise<void> | void;
};

function AccountSetupModal({
  visible,
  target,
  busy = false,
  onCancel,
  onCompleted,
}: AccountSetupModalProps) {
  const featureName = target?.featureName || "this feature";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setError(null);
    setSuccess(null);
  }, [visible]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const id = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [cooldown]);

  const modalBusy = busy || isSendingCode || isVerifyingCode || isCreatingAccount;
  const phoneDigits = digitsOnly(phone);
  const cleanCode = digitsOnly(code);

  const canSendCode =
    !modalBusy && phoneDigits.length === 10 && cooldown === 0;

  const canVerifyCode =
    !modalBusy && codeSent && !phoneVerified && cleanCode.length === 6;

  const canCreateAccount =
    !modalBusy &&
    !!norm(firstName) &&
    looksLikeEmail(email) &&
    phoneDigits.length === 10 &&
    phoneVerified &&
    !!verificationToken &&
    password.length >= 8 &&
    password === passwordConfirm;

  const resetPhoneVerification = () => {
    setCode("");
    setCodeSent(false);
    setPhoneVerified(false);
    setVerificationToken("");
    setMaskedPhone("");
    setCooldown(0);
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneDisplay(value);
    const priorDigits = digitsOnly(phone);
    const nextDigits = digitsOnly(formatted);

    setPhone(formatted);
    setError(null);
    setSuccess(null);

    if (nextDigits !== priorDigits) {
      resetPhoneVerification();
    }
  };

  const handleSendCode = async () => {
    if (!canSendCode) return;

    try {
      setIsSendingCode(true);
      setError(null);
      setSuccess(null);

      const result = await requestPhoneCode(phone);

      if (!result?.ok) {
        setError(friendlyAccountSetupError(result?.error || "Could not send verification code."));
        return;
      }

      setCodeSent(true);
      setPhoneVerified(false);
      setVerificationToken("");
      setCode("");
      setMaskedPhone(result?.data?.maskedPhone || "");
      setCooldown(Number(result?.data?.cooldown || 0));
      setSuccess("Verification code sent.");
    } catch {
      setError("Network error while sending the verification code.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!canVerifyCode) return;

    try {
      setIsVerifyingCode(true);
      setError(null);
      setSuccess(null);

      const result = await verifyPhoneCode(phone, code);

      if (!result?.ok) {
        setError(friendlyAccountSetupError(result?.error || "Invalid or expired code."));
        return;
      }

      setPhoneVerified(true);
      setVerificationToken(result?.data?.verificationToken || "");
      setSuccess("Phone number verified.");
    } catch {
      setError("Network error while verifying the code.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const validateAccountSetup = () => {
    if (!norm(firstName)) return "Please enter your first name.";
    if (!normEmail(email)) return "Please enter your email.";
    if (!looksLikeEmail(email)) return "That email doesn’t look right.";
    if (phoneDigits.length !== 10) return "Please enter a valid 10-digit phone number.";
    if (!phoneVerified || !verificationToken) return "Please verify your phone number first.";
    if (!password) return "Please create a password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!passwordConfirm) return "Please re-type your password.";
    if (password !== passwordConfirm) return "Passwords do not match.";
    return null;
  };

  const handleCreateAccount = async () => {
    if (isCreatingAccount) return;

    const validationError = validateAccountSetup();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsCreatingAccount(true);
      setError(null);
      setSuccess(null);

      const result = await completeSignUp({
        firstName: norm(firstName),
        lastName: norm(lastName),
        email: normEmail(email),
        password: String(password || "").trim(),
        passwordConfirmation: String(passwordConfirm || "").trim(),
        phone: norm(phone),
        verificationToken,
      });

      if (!result?.ok) {
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("auth_user");

        setError(friendlyAccountSetupError(result?.error || "Unable to create account."));
        return;
      }

      const token = String(result?.data?.token || result?.token || "");
      const user = result?.data?.user || result?.user || null;

      if (!token) {
        setError("Account was created, but the server did not return a session. Please sign in.");
        return;
      }

      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("auth_user", JSON.stringify(user || {}));

      if (user?.id != null) {
        await linkRevenueCatCustomerAfterAuth(user.id);
      }

      await onCompleted(user);
    } catch {
      setError("Network error. Could not create your account right now.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.accountModalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.accountModalKeyboardWrap}
        >
          <View style={styles.accountModalCard}>
            <View style={styles.accountModalHeaderRow}>
              <View style={styles.accountModalIconWrap}>
                <Ionicons name="person-add" size={24} color={BRAND.blue} />
              </View>

              <Pressable onPress={onCancel} disabled={modalBusy} hitSlop={10}>
                <Ionicons name="close" size={22} color={BRAND.muted} />
              </Pressable>
            </View>

            <Text style={styles.accountModalTitle}>Finish account setup</Text>
            <Text style={styles.accountModalBody}>
              Premium is active. Add your account info to use {featureName} and connect support to you.
            </Text>

            {!!error && (
              <View style={styles.accountModalErrorBox}>
                <Ionicons name="alert-circle" size={18} color="#D92D20" />
                <Text style={styles.accountModalErrorText}>{error}</Text>
              </View>
            )}

            {!!success && (
              <View style={styles.accountModalSuccessBox}>
                <Ionicons name="checkmark-circle" size={18} color="#039855" />
                <Text style={styles.accountModalSuccessText}>{success}</Text>
              </View>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.accountModalScrollContent}
            >
              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>First Name</Text>
                <View style={styles.accountModalInputRow}>
                  <Ionicons name="person" size={20} color={BRAND.blue} />
                  <TextInput
                    value={firstName}
                    onChangeText={(t) => {
                      setFirstName(t);
                      setError(null);
                    }}
                    placeholder="First name"
                    placeholderTextColor="#98A2B3"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>Last Name (optional)</Text>
                <View style={styles.accountModalInputRow}>
                  <Ionicons name="person-outline" size={20} color={BRAND.blue} />
                  <TextInput
                    value={lastName}
                    onChangeText={(t) => {
                      setLastName(t);
                      setError(null);
                    }}
                    placeholder="Last name"
                    placeholderTextColor="#98A2B3"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>Email</Text>
                <View style={styles.accountModalInputRow}>
                  <Ionicons name="mail" size={20} color={BRAND.blue} />
                  <TextInput
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      setError(null);
                    }}
                    placeholder="you@example.com"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>Phone Number</Text>
                <Text style={styles.accountModalHelper}>
                  We’ll text a 6-digit code before creating your account.
                </Text>

                <View style={styles.accountModalInputRow}>
                  <Ionicons name="call" size={20} color={BRAND.blue} />
                  <TextInput
                    value={phone}
                    onChangeText={handlePhoneChange}
                    placeholder="(555) 555-5555"
                    placeholderTextColor="#98A2B3"
                    keyboardType="phone-pad"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    maxLength={14}
                    returnKeyType="next"
                  />
                  {phoneVerified && (
                    <Ionicons name="checkmark-circle" size={19} color="#039855" />
                  )}
                </View>

                <View style={styles.accountModalPhoneActions}>
                  <Pressable
                    onPress={handleSendCode}
                    disabled={!canSendCode}
                    style={({ pressed }) => [
                      styles.accountModalSmallButton,
                      !canSendCode && styles.accountModalSmallButtonDisabled,
                      pressed && canSendCode && styles.accountModalButtonPressed,
                    ]}
                  >
                    <Ionicons
                      name="chatbox-ellipses"
                      size={15}
                      color={canSendCode ? BRAND.blue : BRAND.muted}
                    />
                    <Text
                      style={[
                        styles.accountModalSmallButtonText,
                        !canSendCode && styles.accountModalSmallButtonTextDisabled,
                      ]}
                    >
                      {isSendingCode
                        ? "Sending..."
                        : codeSent
                          ? cooldown > 0
                            ? `Resend in ${formatCountdown(cooldown)}`
                            : "Resend Code"
                          : "Send Code"}
                    </Text>
                  </Pressable>

                  {phoneVerified && (
                    <View style={styles.accountModalVerifiedPill}>
                      <Ionicons name="shield-checkmark" size={14} color="#039855" />
                      <Text style={styles.accountModalVerifiedText}>Verified</Text>
                    </View>
                  )}
                </View>

                {codeSent && !phoneVerified && (
                  <View style={styles.accountModalVerifyWrap}>
                    <Text style={styles.accountModalLabel}>
                      Enter Code{maskedPhone ? ` sent to ${maskedPhone}` : ""}
                    </Text>
                    <View style={styles.accountModalInputRow}>
                      <Ionicons name="key" size={20} color={BRAND.blue} />
                      <TextInput
                        value={code}
                        onChangeText={(t) => {
                          setCode(digitsOnly(t).slice(0, 6));
                          setError(null);
                        }}
                        placeholder="6-digit code"
                        placeholderTextColor="#98A2B3"
                        keyboardType="number-pad"
                        style={styles.accountModalInput}
                        editable={!modalBusy}
                        maxLength={6}
                        returnKeyType="done"
                        onSubmitEditing={handleVerifyCode}
                      />
                    </View>

                    <Pressable
                      onPress={handleVerifyCode}
                      disabled={!canVerifyCode}
                      style={({ pressed }) => [
                        styles.accountModalVerifyButton,
                        !canVerifyCode && styles.accountModalVerifyButtonDisabled,
                        pressed && canVerifyCode && styles.accountModalButtonPressed,
                      ]}
                    >
                      <Ionicons
                        name="shield-checkmark"
                        size={17}
                        color={canVerifyCode ? "#FFFFFF" : "#98A2B3"}
                      />
                      <Text
                        style={[
                          styles.accountModalVerifyButtonText,
                          !canVerifyCode && styles.accountModalVerifyButtonTextDisabled,
                        ]}
                      >
                        {isVerifyingCode ? "Verifying..." : "Verify Code"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>Password</Text>
                <View style={styles.accountModalInputRow}>
                  <Ionicons name="lock-closed" size={20} color={BRAND.blue} />
                  <TextInput
                    value={password}
                    onChangeText={(t) => {
                      setPassword(t);
                      setError(null);
                    }}
                    secureTextEntry={secure1}
                    placeholder="At least 8 characters"
                    placeholderTextColor="#98A2B3"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    returnKeyType="next"
                  />
                  <Pressable onPress={() => setSecure1((v) => !v)} disabled={modalBusy} hitSlop={10}>
                    <Ionicons name={secure1 ? "eye" : "eye-off"} size={20} color={BRAND.muted} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.accountModalField}>
                <Text style={styles.accountModalLabel}>Confirm Password</Text>
                <View style={styles.accountModalInputRow}>
                  <Ionicons name="lock-open" size={20} color={BRAND.blue} />
                  <TextInput
                    value={passwordConfirm}
                    onChangeText={(t) => {
                      setPasswordConfirm(t);
                      setError(null);
                    }}
                    secureTextEntry={secure2}
                    placeholder="Re-type password"
                    placeholderTextColor="#98A2B3"
                    style={styles.accountModalInput}
                    editable={!modalBusy}
                    returnKeyType="go"
                    onSubmitEditing={handleCreateAccount}
                  />
                  <Pressable onPress={() => setSecure2((v) => !v)} disabled={modalBusy} hitSlop={10}>
                    <Ionicons name={secure2 ? "eye" : "eye-off"} size={20} color={BRAND.muted} />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={handleCreateAccount}
                disabled={!canCreateAccount}
                style={({ pressed }) => [
                  styles.accountModalPrimaryButton,
                  !canCreateAccount && styles.accountModalPrimaryButtonDisabled,
                  pressed && canCreateAccount && styles.accountModalButtonPressed,
                ]}
              >
                {isCreatingAccount ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add" size={18} color="#FFFFFF" />
                    <Text style={styles.accountModalPrimaryButtonText}>Create Account</Text>
                  </>
                )}
              </Pressable>

              <Text style={styles.accountModalLegalText}>
                By creating an account, you agree to receive transactional text messages for verification and support.
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  const auth = useAuth() as any;
  const signIn = auth?.signIn as (() => Promise<void>) | undefined;
  const signOut = auth?.signOut as (() => Promise<void>) | undefined;
  const user = auth?.user as
    | {
        id?: string | number;
        email?: string | null;
        role?: string;
        admin?: boolean;
        is_admin?: boolean;

        // Backend/Rails-controlled premium/support access.
        support_subscription_active?: boolean | null;
        supportSubscriptionActive?: boolean | null;
        is_subscriber?: boolean | null;
        subscriber?: boolean | null;
        premium?: boolean | null;

        current_calls_this_month?: number | null;
        calls_this_month?: number | null;
        monthly_calls_used?: number | null;
        calls_used_this_month?: number | null;

        monthly_call_limit?: number | null;
        call_limit?: number | null;
        monthly_calls_limit?: number | null;
      }
    | undefined;

  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pushSyncUserId, setPushSyncUserId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountSetupTarget, setAccountSetupTarget] =
    useState<AccountSetupTarget | null>(null);

  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const sub = SUBSCRIPTIONS_ENABLED ? useSubscription() : null;
  const isPro = sub?.isPro ?? false;
  const subLoading = sub?.loading ?? false;

  /**
   * HomeScreen gets opened right after Paywall, so we keep a local direct
   * RevenueCat premium state too. This prevents the visible Home buttons from
   * showing PREMIUM locks while useSubscription is still catching up.
   */
  const [homeRcIsPro, setHomeRcIsPro] = useState(false);
  const [homeRcSeenPremium, setHomeRcSeenPremium] = useState(false);
  const [homeRcActiveEntitlementKeys, setHomeRcActiveEntitlementKeys] = useState<string[]>([]);
  const [rcReady, setRcReady] = useState(false);

  const [storedPro, setStoredPro] = useState<boolean | null>(null);
  const storedProLoadedRef = useRef(false);

  const currentUserId = user?.id != null ? String(user.id) : null;
  const hasAccount = !!currentUserId;

  const isAdmin =
    user?.role === "admin" ||
    user?.role === "super_admin" ||
    user?.admin === true ||
    user?.is_admin === true;

  const backendPremium =
    user?.support_subscription_active === true ||
    user?.supportSubscriptionActive === true ||
    user?.is_subscriber === true ||
    user?.subscriber === true ||
    user?.premium === true;

  const normalizedUserEmail =
    typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";

  const hasInstantEmailAccess = INSTANT_ACCESS_EMAILS.has(normalizedUserEmail);

  const currentCallsThisMonth =
    typeof user?.current_calls_this_month === "number"
      ? user.current_calls_this_month
      : typeof user?.calls_this_month === "number"
        ? user.calls_this_month
        : typeof user?.monthly_calls_used === "number"
          ? user.monthly_calls_used
          : typeof user?.calls_used_this_month === "number"
            ? user.calls_used_this_month
            : null;

  const monthlyCallLimit =
    typeof user?.monthly_call_limit === "number"
      ? user.monthly_call_limit
      : typeof user?.call_limit === "number"
        ? user.call_limit
        : typeof user?.monthly_calls_limit === "number"
          ? user.monthly_calls_limit
          : null;

  console.log("📞 [CallUsage] raw auth object:", auth);

  console.log("📞 [CallUsage] raw auth user:", user);

  console.log("📞 [CallUsage] possible user call fields:", {
    current_calls_this_month: user?.current_calls_this_month,
    calls_this_month: user?.calls_this_month,
    monthly_calls_used: user?.monthly_calls_used,
    calls_used_this_month: user?.calls_used_this_month,

    monthly_call_limit: user?.monthly_call_limit,
    call_limit: user?.call_limit,
    monthly_calls_limit: user?.monthly_calls_limit,

    resolved_currentCallsThisMonth: currentCallsThisMonth,
    resolved_monthlyCallLimit: monthlyCallLimit,
  });

  const hookActiveEntitlementKeys = Object.keys(
    sub?.customerInfo?.entitlements?.active ?? {}
  );
  const hookHasActiveEntitlements = hookActiveEntitlementKeys.length > 0;
  const hasHomeRcActiveEntitlements = homeRcActiveEntitlementKeys.length > 0;

  /**
   * IMPORTANT:
   * For HomeScreen visuals, any active RevenueCat entitlement means premium.
   * This intentionally does not rely only on ENTITLEMENT_ID because your logs
   * show RevenueCat returning active keys like ["pro", "Mom’s Computer Pro"].
   */
  const revenueCatPremiumDetected =
    isPro ||
    hookHasActiveEntitlements ||
    homeRcIsPro ||
    hasHomeRcActiveEntitlements ||
    homeRcSeenPremium;

  const hasPremiumAccess =
    isAdmin ||
    revenueCatPremiumDetected ||
    backendPremium ||
    hasInstantEmailAccess ||
    DEV_PAYWALL_BYPASS;

  const shouldShowSubscriptionChecking =
    SUBSCRIPTIONS_ENABLED &&
    !DEV_PAYWALL_BYPASS &&
    !isAdmin &&
    !backendPremium &&
    !hasInstantEmailAccess &&
    (subLoading || !rcReady);

  // Do not show PREMIUM locks while RevenueCat is still checking.
  // This avoids the exact stale state where Paywall says active, but Home still
  // briefly shows locked premium buttons.
  const shouldShowPremiumLocks =
    SUBSCRIPTIONS_ENABLED &&
    !shouldShowSubscriptionChecking &&
    !hasPremiumAccess &&
    !revenueCatPremiumDetected;

  const shouldShowAccountSetupLocks =
    SUBSCRIPTIONS_ENABLED &&
    !shouldShowSubscriptionChecking &&
    hasPremiumAccess &&
    !hasAccount;

  console.log("💳 [PremiumGate]", {
    email: normalizedUserEmail,
    hasAccount,
    hasInstantEmailAccess,
    isAdmin,
    isPro,
    hookActiveEntitlementKeys,
    hookHasActiveEntitlements,
    homeRcIsPro,
    homeRcSeenPremium,
    homeRcActiveEntitlementKeys,
    hasHomeRcActiveEntitlements,
    revenueCatPremiumDetected,
    rcReady,
    subLoading,
    shouldShowSubscriptionChecking,
    shouldShowPremiumLocks,
    shouldShowAccountSetupLocks,
    backendPremium,
    hasPremiumAccess,
    support_subscription_active: user?.support_subscription_active,
    supportSubscriptionActive: user?.supportSubscriptionActive,
    is_subscriber: user?.is_subscriber,
    subscriber: user?.subscriber,
    premium: user?.premium,
  });

  const [textMomUnreadCount, setTextMomUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const seen = await readHomeRcSeenPremium();

      if (!cancelled) {
        console.log("💳 [PremiumGate] loaded persisted Home RC premium flag:", seen);
        setHomeRcSeenPremium(seen);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    console.log("🏠 [HomeBadge] mounted");
    console.log("🏠 [HomeBadge] initial user:", user);
    console.log("🏠 [HomeBadge] initial currentUserId:", currentUserId);
    console.log("🏠 [HomeBadge] initial isLoggingOut:", isLoggingOut);

    return () => {
      console.log("🏠 [HomeBadge] unmounted");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log("🏠 [HomeBadge] auth/user state changed:", {
      currentUserId,
      hasAccount,
      userId: user?.id,
      role: user?.role,
      isAdmin,
      backendPremium,
      isLoggingOut,
      currentCallsThisMonth,
      monthlyCallLimit,
    });
  }, [
    currentUserId,
    hasAccount,
    user?.id,
    user?.role,
    isAdmin,
    backendPremium,
    isLoggingOut,
    currentCallsThisMonth,
    monthlyCallLimit,
  ]);

  useEffect(() => {
    console.log("🏠 [HomeBadge] textMomUnreadCount changed:", textMomUnreadCount);
  }, [textMomUnreadCount]);

  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) return;

    if (DEV_PAYWALL_BYPASS) {
      setRcReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setRcReady(false);

        if (!user?.id) {
          await sub?.refresh?.();
          const info = await getCustomerInfo();
          const activeKeys = Object.keys(info?.entitlements?.active ?? {});
          const homePremium = homeHasPremiumEntitlement(info);

          console.log("💳 [PremiumGate] mount anonymous CustomerInfo", {
            originalAppUserId: info?.originalAppUserId,
            activeKeys,
            homePremium,
          });

          if (!cancelled) {
            const premiumFromKeys = activeKeys.length > 0 || homePremium;
            setHomeRcActiveEntitlementKeys(activeKeys);
            setHomeRcIsPro(premiumFromKeys);
            setHomeRcSeenPremium(premiumFromKeys);
            await writeHomeRcSeenPremium(premiumFromKeys);
            setRcReady(true);
          }
          return;
        }

        if (isAdmin) {
          if (!cancelled) {
            setHomeRcActiveEntitlementKeys(["admin"]);
            setHomeRcIsPro(true);
            setHomeRcSeenPremium(true);
            await writeHomeRcSeenPremium(true);
            setRcReady(true);
          }
          return;
        }

        await rcIdentifyUser(String(user.id));
        await sub?.refresh?.();
        const info = await getCustomerInfo();
        const activeKeys = Object.keys(info?.entitlements?.active ?? {});
        const homePremium = homeHasPremiumEntitlement(info);

        console.log("💳 [PremiumGate] mount signed-in CustomerInfo", {
          userId: user?.id,
          originalAppUserId: info?.originalAppUserId,
          activeKeys,
          homePremium,
        });

        if (!cancelled) {
          const premiumFromKeys = activeKeys.length > 0 || homePremium;
          setHomeRcActiveEntitlementKeys(activeKeys);
          setHomeRcIsPro(premiumFromKeys);
          setHomeRcSeenPremium(premiumFromKeys);
          await writeHomeRcSeenPremium(premiumFromKeys);
          setRcReady(true);
        }
      } catch (error) {
        console.log("💳 [PremiumGate] mount subscription refresh failed:", error);
        if (!cancelled) setRcReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useFocusEffect(
    React.useCallback(() => {
      if (!SUBSCRIPTIONS_ENABLED) return;

      if (DEV_PAYWALL_BYPASS) {
        setRcReady(true);
        return;
      }

      let active = true;

      (async () => {
        try {
          setRcReady(false);

          if (user?.id && !isAdmin) {
            await rcIdentifyUser(String(user.id));
          }

          if (isAdmin) {
            if (active) {
              setHomeRcActiveEntitlementKeys(["admin"]);
              setHomeRcIsPro(true);
              setRcReady(true);
            }
            return;
          }

          await sub?.refresh?.();
          const info = await getCustomerInfo();
          const activeKeys = Object.keys(info?.entitlements?.active ?? {});
          const homePremium = homeHasPremiumEntitlement(info);

          console.log("💳 [PremiumGate] focus CustomerInfo", {
            userId: user?.id ?? null,
            hasAccount,
            originalAppUserId: info?.originalAppUserId,
            activeKeys,
            entitlementIdMatched: isProActive(info),
            homePremium,
          });

          if (active) {
            const premiumFromKeys = activeKeys.length > 0 || homePremium;
            setHomeRcActiveEntitlementKeys(activeKeys);
            setHomeRcIsPro(premiumFromKeys);
            setHomeRcSeenPremium(premiumFromKeys);
            await writeHomeRcSeenPremium(premiumFromKeys);
            setRcReady(true);
          }
        } catch (error) {
          console.log("💳 [PremiumGate] focus subscription refresh failed:", error);

          if (active) {
            setRcReady(true);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [user?.id, isAdmin])
  );

  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) return;

    if (DEV_PAYWALL_BYPASS) {
      storedProLoadedRef.current = true;
      setStoredPro(true);
      return;
    }

    if (!user?.id) {
      storedProLoadedRef.current = true;
      setStoredPro(null);
      return;
    }

    if (isAdmin) {
      storedProLoadedRef.current = true;
      setStoredPro(true);
      return;
    }

    let cancelled = false;

    (async () => {
      storedProLoadedRef.current = false;
      setStoredPro(null);

      const v = await readStoredPro(String(user.id));
      if (!cancelled) {
        setStoredPro(v);
        storedProLoadedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!SUBSCRIPTIONS_ENABLED) return;
    if (DEV_PAYWALL_BYPASS) return;
    if (!user?.id) return;
    if (isAdmin) return;
    if (!rcReady) return;
    if (subLoading) return;
    if (!storedProLoadedRef.current) return;

    const userId = String(user.id);
    const effectivePro = isPro || backendPremium;

    if (storedPro === null) {
      writeStoredPro(userId, effectivePro);
      setStoredPro(effectivePro);
      return;
    }

    if (!storedPro && effectivePro) {
      Alert.alert("✅ Subscription active!");

      writeStoredPro(userId, true);
      setStoredPro(true);
      return;
    }

    if (storedPro !== effectivePro) {
      writeStoredPro(userId, effectivePro);
      setStoredPro(effectivePro);
    }
  }, [
    user?.id,
    isAdmin,
    rcReady,
    subLoading,
    isPro,
    backendPremium,
    storedPro,
    router,
  ]);

  useEffect(() => {
    if (!currentUserId) {
      setPushSyncUserId(null);
      return;
    }

    if (pushSyncUserId !== currentUserId) {
      setPushSyncUserId(null);
    }
  }, [currentUserId, pushSyncUserId]);

  useEffect(() => {
    let cancelled = false;

    const syncPushToken = async () => {
      if (!currentUserId) return;
      if (isLoggingOut) return;
      if (pushSyncUserId === currentUserId) return;

      try {
        const token = await getAuthToken();
        if (!token) {
          console.log("No auth token found; skipping push token sync.");
          return;
        }

        const pushToken = await registerForPushNotificationsAsync();
        if (!pushToken) {
          console.log("No push token returned.");
          return;
        }

        const notificationsEnabled = await hasNotificationPermission();

        const payload = {
          device: {
            platform: Platform.OS,
            device_name:
              Device.deviceName ||
              Device.modelName ||
              `${Platform.OS} device`,
            os_version:
              Device.osVersion || String(Platform.Version || ""),
            app_version:
              Application.nativeApplicationVersion || "dev",
            push_token: pushToken,
            notifications_enabled: notificationsEnabled,
          },
        };

        const res = await postJson("/v1/devices/register", payload, token);

        if (!cancelled) {
          if (res.ok) {
            console.log("✅ Push token synced to backend", res.json);
            setPushSyncUserId(currentUserId);
          } else {
            console.log("❌ Failed to sync push token", res.status, res.json);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.log("❌ Push token sync error", error);
        }
      }
    };

    syncPushToken();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, isLoggingOut, pushSyncUserId]);

  useEffect(() => {
    let mounted = true;

    console.log("🏠 [HomeBadge] local badge subscription effect started");

    getTextMomUnreadCount().then((count) => {
      console.log("🏠 [HomeBadge] getTextMomUnreadCount resolved:", count);

      if (mounted) {
        console.log("🏠 [HomeBadge] setting local stored count into state:", count);
        setTextMomUnreadCount(count);
      } else {
        console.log("🏠 [HomeBadge] skipped stored count because unmounted:", count);
      }
    });

    const unsubscribe = subscribeToTextMomUnreadCount((count) => {
      console.log("🏠 [HomeBadge] subscription listener received count:", count);
      setTextMomUnreadCount(count);
    });

    return () => {
      console.log("🏠 [HomeBadge] local badge subscription effect cleanup");
      mounted = false;
      unsubscribe();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;

      console.log("🏠 [HomeBadge] useFocusEffect fired");
      console.log("🏠 [HomeBadge] focus currentUserId:", currentUserId);
      console.log("🏠 [HomeBadge] focus isLoggingOut:", isLoggingOut);

      if (!currentUserId || isLoggingOut) {
        console.log("⚠️ [HomeBadge] focus skipped refresh; clearing badge", {
          currentUserId,
          isLoggingOut,
        });

        setTextMomUnreadCount(0);

        return () => {
          console.log("🏠 [HomeBadge] focus cleanup after skipped refresh");
          active = false;
        };
      }

      console.log("🏠 [HomeBadge] calling refreshTextMomUnreadCountFromServer");

      refreshTextMomUnreadCountFromServer().then((count) => {
        console.log("🏠 [HomeBadge] refresh promise resolved count:", count);
        console.log("🏠 [HomeBadge] focus still active:", active);

        if (active) {
          console.log("🏠 [HomeBadge] setting refreshed count into state:", count);
          setTextMomUnreadCount(count);
        } else {
          console.log("⚠️ [HomeBadge] skipped refreshed count because focus inactive:", count);
        }
      });

      return () => {
        console.log("🏠 [HomeBadge] useFocusEffect cleanup");
        active = false;
      };
    }, [currentUserId, isLoggingOut])
  );

  const openPaywall = (featureName: string) => {
    router.push({
      pathname: "/paywall",
      params: {
        feature: featureName,
      },
    });
  };

  const handleOpenPremium = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);
    openPaywall("Premium");
  };

  const handleGoToSignIn = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);
    router.push("/(auth)/sign-in");
  };

  const handleGoToSignUp = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);
    router.push({
      pathname: "/(auth)/sign-up",
      params: { intent: "premium_account_setup" },
    });
  };

  const openAccountSetupModal = (featureName: string, route: string) => {
    setSettingsOpen(false);

    router.push({
      pathname: "/(auth)/sign-up",
      params: {
        intent: "premium_account_setup",
        feature: featureName,
        next: route,
      },
    });
  };

  const closeAccountSetupModal = () => {
    if (isLoggingOut) return;
    setAccountSetupTarget(null);
  };

  const handleAccountSetupCompleted = async (_user: any) => {
    const targetRoute = accountSetupTarget?.route;

    if (signIn) {
      await signIn();
    }

    await sub?.refresh?.();
    setAccountSetupTarget(null);

    if (targetRoute) {
      router.push(targetRoute as any);
    }
  };

  const handleAskMomPress = () => {
    if (isLoggingOut) return;

    setSettingsOpen(false);

    if (hasAccount) {
      router.push("/(app)/ask-mom");
    } else {
      router.push("/public-ask-mom");
    }
  };

  const handlePremiumFeaturePress = (
    route: string,
    featureName: string,
    options?: {
      requiresAccount?: boolean;
    }
  ) => {
    if (isLoggingOut) return;

    setSettingsOpen(false);

    const requiresAccount = options?.requiresAccount === true;

    if (!SUBSCRIPTIONS_ENABLED || DEV_PAYWALL_BYPASS) {
      if (requiresAccount && !hasAccount) {
        openAccountSetupModal(featureName, route);
        return;
      }

      router.push(route as any);
      return;
    }

    if (!rcReady || subLoading) {
      Alert.alert(
        "Checking subscription",
        "Give us one second to confirm your subscription status."
      );
      return;
    }

    if (!hasPremiumAccess) {
      openPaywall(featureName);
      return;
    }

    if (requiresAccount && !hasAccount) {
      openAccountSetupModal(featureName, route);
      return;
    }

    router.push(route as any);
  };

  const handleOpenProfile = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);

    if (!hasAccount) {
      router.push("/(auth)/sign-in");
      return;
    }

    router.push("/(app)/profile");
  };

  const handleOpenSubscription = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);
    router.push("/(app)/subscription-privileges");
  };

  const handleGoToChangePassword = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);

    if (!hasAccount) {
      router.push("/(auth)/sign-in");
      return;
    }

    router.push("/(app)/change-password");
  };

  const handleOpenDeleteAccount = () => {
    if (isLoggingOut) return;
    setSettingsOpen(false);

    if (!hasAccount) {
      router.push("/(auth)/sign-in");
      return;
    }

    router.push("/(app)/delete-account");
  };

  const handleLogout = () => {
    if (isLoggingOut) return;

    setSettingsOpen(false);

    Alert.alert("Log out?", "You’ll need to sign in again to use account features.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          setIsLoggingOut(true);
          try {
            const token = await SecureStore.getItemAsync("auth_token");

            if (token) {
              try {
                await postJson("/v1/auth/logout", {}, token);
              } catch {}
            }

            if (SUBSCRIPTIONS_ENABLED && !DEV_PAYWALL_BYPASS) {
              await rcLogoutUser();
            }

            if (signOut) {
              await signOut();
            }

            router.replace("/(auth)/sign-in");
          } finally {
            setIsLoggingOut(false);
            setRcReady(false);
            setStoredPro(null);
            storedProLoadedRef.current = false;
            setPushSyncUserId(null);
            setSettingsOpen(false);
          }
        },
      },
    ]);
  };

  const handleEmailTextMom = () => {
    handlePremiumFeaturePress("/(app)/text-mom", "Text Mom", {
      requiresAccount: true,
    });
  };

  const handleCallMom = () => {
    handlePremiumFeaturePress("/(app)/call-mom", "Call Mom", {
      requiresAccount: true,
    });
  };

  const bigBtnTextStyle = useMemo(
    () => [styles.bigBtnText, isNarrow && styles.bigBtnTextNarrow],
    [isNarrow]
  );

  const FOOTER_MIN_HEIGHT = 64;
  const footerPaddingBottom = Math.max(insets.bottom, 10) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  console.log("🏠 [HomeBadge] render:", {
    currentUserId,
    hasAccount,
    isLoggingOut,
    textMomUnreadCount,
    willShowBadge: textMomUnreadCount > 0,
    currentCallsThisMonth,
    monthlyCallLimit,
  });

  console.log("📞 [CallUsage] passing to HomeSettingsMenu:", {
    currentCallsThisMonth,
    monthlyCallLimit,
  });

  console.log("💳 [PremiumGate] visual decision", {
    rcReady,
    subLoading,
    isPro,
    hookActiveEntitlementKeys,
    hookHasActiveEntitlements,
    homeRcIsPro,
    homeRcSeenPremium,
    homeRcActiveEntitlementKeys,
    revenueCatPremiumDetected,
    hasPremiumAccess,
    hasAccount,
    shouldShowSubscriptionChecking,
    shouldShowPremiumLocks,
    shouldShowAccountSetupLocks,
  });

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={[styles.screen, { paddingTop: 8, paddingBottom: 10 }]}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />

          <HomeSettingsMenu
            open={settingsOpen}
            disabled={isLoggingOut}
            hasAccount={hasAccount}
            hasPremiumAccess={hasPremiumAccess}
            currentCallsThisMonth={currentCallsThisMonth}
            monthlyCallLimit={monthlyCallLimit}
            onToggle={() => setSettingsOpen((prev) => !prev)}
            onClose={() => setSettingsOpen(false)}
            onOpenPremium={handleOpenPremium}
            onOpenProfile={handleOpenProfile}
            onOpenSubscription={handleOpenSubscription}
            onSignIn={handleGoToSignIn}
            onSignUp={handleGoToSignUp}
            onChangePassword={handleGoToChangePassword}
            onDeleteAccount={handleOpenDeleteAccount}
            onLogout={handleLogout}
          />
        </View>

        <View style={[styles.main, { paddingBottom: footerTotalHeight }]}>
          <View style={[styles.row, styles.rowFullBleed]}>
            <View style={styles.bannerRow}>
              <View style={styles.logoBanner}>
                <Image source={{ uri: LOGO_URI }} style={styles.logo} resizeMode="cover" />
              </View>
            </View>
          </View>

          <AnimatedHint />

          <View style={[styles.actionsWrap, { paddingTop: 4 }]}>
            <View style={styles.actions}>
              <Pressable
                onPress={handleAskMomPress}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="chatbubble-ellipses" size={34} color={BRAND.blue} />
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    ASK MOM
                  </Text>

                  <Text style={styles.btnSubText}>When something doesn’t feel right</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleEmailTextMom}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.premiumBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                {shouldShowPremiumLocks && <PremiumPerch />}
                {shouldShowAccountSetupLocks && <AccountSetupPerch />}

                <View style={styles.iconPill}>
                  <Ionicons name="mail" size={34} color={BRAND.blue} />

                  {shouldShowPremiumLocks && (
                    <View style={styles.lockDot}>
                      <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {shouldShowAccountSetupLocks && (
                    <View style={styles.accountDot}>
                      <Ionicons name="person-add" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {textMomUnreadCount > 0 && (
                    <View style={styles.textMomBadge}>
                      <Text style={styles.textMomBadgeText}>
                        {textMomUnreadCount > 99 ? "99+" : textMomUnreadCount}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    EMAIL / TEXT MOM
                  </Text>

                  <Text style={styles.btnSubText}>
                    {shouldShowAccountSetupLocks
                      ? "Create account to message support"
                      : "For non-urgent questions"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleCallMom}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.premiumBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                {shouldShowPremiumLocks && <PremiumPerch />}
                {shouldShowAccountSetupLocks && <AccountSetupPerch />}

                <View style={styles.iconPill}>
                  <Ionicons name="call" size={34} color={BRAND.blue} />

                  {shouldShowPremiumLocks && (
                    <View style={styles.lockDot}>
                      <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {shouldShowAccountSetupLocks && (
                    <View style={styles.accountDot}>
                      <Ionicons name="person-add" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    CALL MOM
                  </Text>

                  <Text style={styles.btnSubText}>
                    {shouldShowAccountSetupLocks
                      ? "Create account to connect phone support"
                      : "When you need to talk to a real person"}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.premiumInfoCard}>
                <View style={styles.premiumInfoHeader}>
                  <View style={styles.premiumInfoIcon}>
                    <Ionicons name="heart" size={15} color={BRAND.blue} />
                  </View>

                  <Text style={styles.premiumInfoTitle}>Ask Mom is free</Text>
                </View>

                <Text style={styles.premiumInfoBody}>
                  Use Ask Mom anytime. Premium unlocks Text Mom and Call Mom, and you can subscribe before creating an account.
                </Text>

                <Pressable
                  onPress={handleOpenPremium}
                  disabled={isLoggingOut}
                  style={({ pressed }) => [
                    styles.premiumInfoButton,
                    hasPremiumAccess && styles.premiumInfoButtonActive,
                    pressed && !isLoggingOut && styles.premiumInfoButtonPressed,
                    isLoggingOut && styles.disabledBtn,
                  ]}
                >
                  <Ionicons
                    name={hasPremiumAccess ? "checkmark-circle" : "diamond-outline"}
                    size={16}
                    color={BRAND.goldDark}
                  />

                  <Text style={styles.premiumInfoButtonText}>
                    {hasPremiumAccess ? "Premium Active" : "View Premium"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {shouldShowSubscriptionChecking && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ color: BRAND.muted, fontFamily: FONT.regular, fontSize: 12 }}>
                Checking subscription…
              </Text>
            </View>
          )}
        </View>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: footerPaddingBottom,
              minHeight: FOOTER_MIN_HEIGHT,
            },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="shield-checkmark" size={22} color={BRAND.blue} />

          <Text style={styles.footerText}>
            Mom&apos;s Scam Helpline{"\n"}Since 2<Text style={styles.footerZero}>0</Text>13
          </Text>
        </View>

        <AccountSetupModal
          visible={!!accountSetupTarget}
          target={accountSetupTarget}
          busy={isLoggingOut}
          onCancel={closeAccountSetupModal}
          onCompleted={handleAccountSetupCompleted}
        />

        {isLoggingOut && (
          <View style={styles.logoutOverlay} pointerEvents="auto">
            <View style={styles.logoutModal}>
              <ActivityIndicator size="large" color={BRAND.blue} />
              <Text style={styles.logoutTitle}>Logging out…</Text>
              <Text style={styles.logoutSub}>Securing your session and signing you out.</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const H_PADDING = 18;
const LOGO_ASPECT_RATIO = 2.32;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.pageBg },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: H_PADDING,
  },

  topBar: {
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: IS_ANDROID ? 0 : 2,
    paddingBottom: IS_ANDROID ? 4 : 6,
  },

  premiumTopChip: {
    minHeight: 38,
    maxWidth: 152,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: BRAND.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
  },

  premiumTopChipActive: {
    backgroundColor: BRAND.goldSoft,
    borderColor: BRAND.goldBorder,
  },

  premiumTopChipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  premiumTopChipText: {
    color: BRAND.goldDark,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 12 : 13,
    letterSpacing: 0.2,
  },

  main: { flex: 1, justifyContent: "flex-start" },

  row: { width: "100%", alignItems: "center" },

  rowFullBleed: { alignSelf: "stretch", alignItems: "stretch" },

  bannerRow: { width: "100%" },

  logoBanner: {
    marginLeft: -H_PADDING,
    marginRight: -H_PADDING,
    backgroundColor: "#FFFFFF",
    width: undefined,
    aspectRatio: LOGO_ASPECT_RATIO,
    overflow: "hidden",
    borderRadius: 14,
  },

  logo: { width: "100%", height: "100%" },

  hintRow: {
    marginTop: IS_ANDROID ? 8 : 10,
    marginBottom: IS_ANDROID ? 10 : 14,
    width: "100%",
  },

  hintCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: IS_ANDROID ? 10 : 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    overflow: "hidden",
  },

  hintSheen: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: 90,
    backgroundColor: "#FFFFFF",
    opacity: 0.35,
    transform: [{ rotate: "18deg" }],
  },

  hintIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  hintTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },

  hintLinePrimary: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
    letterSpacing: 0.1,
  },

  hintLineSecondary: {
    marginTop: 3,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 12 : 13,
    lineHeight: IS_ANDROID ? 16 : 17,
  },

  actionsWrap: { flex: 1, justifyContent: "flex-start" },

  actions: { width: "100%", gap: IS_ANDROID ? 10 : 12 },

  bigBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    paddingVertical: IS_ANDROID ? 20 : 24,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  premiumBtn: {
    position: "relative",
    overflow: "visible",
  },

  premiumPerch: {
    position: "absolute",
    top: -10,
    right: 8,
    zIndex: 30,
  },

  premiumPerchInner: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: BRAND.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
    shadowColor: BRAND.gold,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },

  premiumGlisten: {
    position: "absolute",
    top: -12,
    bottom: -12,
    width: 24,
    backgroundColor: "#FFFFFF",
  },

  premiumPerchText: {
    color: BRAND.goldDark,
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 1.1,
  },



  accountSetupPerch: {
    position: "absolute",
    top: -10,
    right: 8,
    zIndex: 30,
  },

  accountSetupPerchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    shadowColor: BRAND.blue,
    shadowOpacity: 0.18,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  accountSetupPerchText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 10,
    letterSpacing: 1.1,
  },

  bigBtnPressed: { transform: [{ scale: 0.99 }], opacity: 0.98 },

  disabledBtn: { opacity: 0.55 },

  premiumInfoCard: {
    width: "100%",
    borderRadius: 18,
    paddingVertical: IS_ANDROID ? 12 : 14,
    paddingHorizontal: 14,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  premiumInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  premiumInfoIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  premiumInfoTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 14 : 15,
    letterSpacing: 0.2,
  },

  premiumInfoBody: {
    marginTop: 8,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 12 : 13,
    lineHeight: IS_ANDROID ? 17 : 18,
  },

  premiumInfoButton: {
    marginTop: 11,
    minHeight: 42,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BRAND.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
  },

  premiumInfoButtonActive: {
    backgroundColor: BRAND.goldSoft,
    borderColor: BRAND.goldBorder,
  },

  premiumInfoButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  premiumInfoButtonText: {
    color: BRAND.goldDark,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
    letterSpacing: 0.2,
  },

  iconPill: {
    width: 64,
    height: 40,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    position: "relative",
  },

  lockDot: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.gold,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: BRAND.gold,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  accountDot: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blue,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: BRAND.blue,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  textWrap: {
    flex: 1,
    minWidth: 0,
  },

  bigBtnText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 21 : 24,
    letterSpacing: IS_ANDROID ? 0.7 : 1.0,
    flexShrink: 1,
  },

  bigBtnTextNarrow: { letterSpacing: IS_ANDROID ? 0.25 : 0.4 },

  btnSubText: {
    marginTop: IS_ANDROID ? 4 : 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    letterSpacing: 0.2,
    flexShrink: 1,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: IS_ANDROID ? 6 : 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
    backgroundColor: BRAND.screenBg,
  },

  footerText: {
    fontSize: 14,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  footerZero: {
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
    }),
  },

  logoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 18, 32, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  logoutModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: IS_ANDROID ? 16 : 18,
    paddingHorizontal: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  logoutTitle: {
    marginTop: 12,
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 17 : 18,
    letterSpacing: 0.3,
  },

  logoutSub: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    textAlign: "center",
    lineHeight: IS_ANDROID ? 17 : 18,
  },

  textMomBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  textMomBadgeText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 11,
    lineHeight: 13,
  },

  accountModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 18, 32, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },

  accountModalKeyboardWrap: {
    width: "100%",
    maxWidth: 430,
  },

  accountModalCard: {
    width: "100%",
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  accountModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  accountModalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  accountModalTitle: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 21 : 22,
    letterSpacing: 0.2,
  },

  accountModalBody: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 18 : 19,
  },

  accountModalScrollContent: {
    paddingTop: 6,
    paddingBottom: 4,
  },

  accountModalField: {
    marginTop: 12,
  },

  accountModalLabel: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 12 : 13,
  },

  accountModalHelper: {
    marginTop: 5,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 16,
  },

  accountModalInputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: IS_ANDROID ? 9 : 13,
    backgroundColor: "#FFFFFF",
  },

  accountModalInput: {
    flex: 1,
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 15,
    paddingVertical: 0,
  },

  accountModalPhoneActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },

  accountModalSmallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },

  accountModalSmallButtonDisabled: {
    borderColor: BRAND.border,
    backgroundColor: "#F8FAFC",
  },

  accountModalSmallButtonText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  accountModalSmallButtonTextDisabled: {
    color: BRAND.muted,
  },

  accountModalVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#D1FADF",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },

  accountModalVerifiedText: {
    color: "#039855",
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  accountModalVerifyWrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  accountModalVerifyButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  accountModalVerifyButtonDisabled: {
    backgroundColor: "#E4E7EC",
  },

  accountModalVerifyButtonText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 13,
  },

  accountModalVerifyButtonTextDisabled: {
    color: "#98A2B3",
  },

  accountModalPrimaryButton: {
    marginTop: 16,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },

  accountModalPrimaryButtonDisabled: {
    opacity: 0.55,
  },

  accountModalPrimaryButtonText: {
    color: "#FFFFFF",
    fontFamily: FONT.semi,
    fontSize: 15,
    letterSpacing: 0.3,
  },

  accountModalButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  accountModalErrorBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#FEF3F2",
    borderWidth: 1,
    borderColor: "#FEE4E2",
  },

  accountModalErrorText: {
    flex: 1,
    color: "#D92D20",
    fontFamily: FONT.medium,
    fontSize: 12,
    lineHeight: 16,
  },

  accountModalSuccessBox: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 13,
    backgroundColor: "#ECFDF3",
    borderWidth: 1,
    borderColor: "#D1FADF",
  },

  accountModalSuccessText: {
    flex: 1,
    color: "#039855",
    fontFamily: FONT.medium,
    fontSize: 12,
    lineHeight: 16,
  },

  accountModalLegalText: {
    marginTop: 12,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },

});