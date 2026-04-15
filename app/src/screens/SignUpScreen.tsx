import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthProvider";
import {
  completeSignUp,
  requestPhoneCode,
  verifyPhoneCode,
} from "../services/auth";
import { FONT } from "./../theme";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  inputBg: "#FFFFFF",
  danger: "#D92D20",
  dangerSoft: "#FEF3F2",
  warn: "#DC6803",
  warnSoft: "#FFFAEB",
  ok: "#039855",
  okSoft: "#ECFDF3",
};

const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1769703507/ChatGPT_Image_Jan_29_2026_08_00_07_AM_1_3_gtqeo8.jpg";

const PRIVACY_POLICY_URL = "https://momscomputer.com/privacy/";
const TERMS_URL = "https://momscomputer.com/terms/";

const H_PADDING = 18;
const LOGO_ASPECT_RATIO = 1.75;
const LOGO_BOTTOM_GAP = 10;

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

function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function letAnimationBeSeen(ms: number): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => resolve(), ms);
    });
  });
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;

  if (mins <= 0) return `${secs}s`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

type PwHintState = "hidden" | "match" | "mismatch";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [inlineSuccess, setInlineSuccess] = useState<string | null>(null);

  const [pwHint, setPwHint] = useState<PwHintState>("hidden");
  const confirmTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (confirmTypingTimerRef.current) {
        clearTimeout(confirmTypingTimerRef.current);
        confirmTypingTimerRef.current = null;
      }
    };
  }, []);

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

  const clearAllErrors = () => {
    setNameError(null);
    setEmailError(null);
    setPhoneError(null);
    setCodeError(null);
    setPasswordError(null);
    setGeneralError(null);
  };

  const clearFieldErrorsOnEdit = (field: "name" | "email" | "phone" | "code" | "password") => {
    if (field === "name") setNameError(null);
    if (field === "email") setEmailError(null);
    if (field === "phone") {
      setPhoneError(null);
      setCodeError(null);
    }
    if (field === "code") setCodeError(null);
    if (field === "password") setPasswordError(null);
    setGeneralError(null);
  };

  const setCategorizedError = (message: string) => {
    const msg = String(message || "").trim();
    const lower = msg.toLowerCase();

    clearAllErrors();

    if (
      lower.includes("first name") ||
      lower.includes("last name") ||
      lower === "please enter your first name."
    ) {
      setNameError(msg);
      return;
    }

    if (lower.includes("email")) {
      setEmailError(msg);
      return;
    }

    if (
      lower.includes("6-digit code") ||
      lower.includes("invalid or expired code") ||
      lower.includes("verification code") ||
      lower.includes("enter the 6-digit code")
    ) {
      setCodeError(msg);
      return;
    }

    if (
      lower.includes("phone") ||
      lower.includes("number") ||
      lower.includes("verification token")
    ) {
      setPhoneError(msg);
      return;
    }

    if (lower.includes("password")) {
      setPasswordError(msg);
      return;
    }

    setGeneralError(msg);
  };

  const schedulePwHintCheck = (nextConfirm: string, delayMs = 700) => {
    if (confirmTypingTimerRef.current) {
      clearTimeout(confirmTypingTimerRef.current);
      confirmTypingTimerRef.current = null;
    }

    setPwHint("hidden");

    confirmTypingTimerRef.current = setTimeout(() => {
      const pw = String(password || "");
      const pc = String(nextConfirm || "");

      if (!pw || !pc) {
        setPwHint("hidden");
        return;
      }

      setPwHint(pw === pc ? "match" : "mismatch");
    }, delayMs);
  };

  const fillAnim = useRef(new Animated.Value(0)).current;

  const btnWidthRef = useRef<number>(0);
  const [btnWidth, setBtnWidth] = useState(0);

  const onPrimaryLayout = (e: any) => {
    const w = e?.nativeEvent?.layout?.width ?? 0;
    if (w > 0 && w !== btnWidthRef.current) {
      btnWidthRef.current = w;
      setBtnWidth(w);
    }
  };

  const travelDist = useMemo(() => {
    const w = btnWidthRef.current || btnWidth || 0;
    if (!w) return 120;
    return Math.max(90, Math.min(160, w * 0.35));
  }, [btnWidth]);

  const iconTravel = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, travelDist],
  });

  const fillTransform = useMemo(() => {
    const w = btnWidthRef.current || btnWidth || 0;
    if (!w) return [{ scaleX: fillAnim }] as any;
    return [{ translateX: -w / 2 }, { scaleX: fillAnim }, { translateX: w / 2 }] as any;
  }, [btnWidth, fillAnim]);

  const runFillAnim = () =>
    new Promise<void>((resolve) => {
      fillAnim.stopAnimation();
      fillAnim.setValue(0);
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => resolve());
    });

  const resetFillAnim = () =>
    new Promise<void>((resolve) => {
      fillAnim.stopAnimation();
      Animated.timing(fillAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => resolve());
    });

  const validateClient = () => {
    const fn = norm(firstName);
    const em = normEmail(email);
    const pw = String(password || "");
    const pc = String(passwordConfirm || "");
    const phoneDigits = digitsOnly(phone);

    if (!fn) return { field: "name", message: "Please enter your first name." };
    if (!em) return { field: "email", message: "Please enter your email." };
    if (!looksLikeEmail(em)) return { field: "email", message: "That email doesn’t look right." };
    if (!phoneDigits) return { field: "phone", message: "Please enter your phone number." };
    if (phoneDigits.length !== 10) return { field: "phone", message: "Enter a valid 10-digit phone number." };
    if (!phoneVerified || !verificationToken) {
      return { field: "phone", message: "Please verify your phone number first." };
    }
    if (!pw) return { field: "password", message: "Please create a password." };
    if (pw.length < 8) return { field: "password", message: "Password must be at least 8 characters." };
    if (!pc) return { field: "password", message: "Please re-type your password." };
    if (pw !== pc) return { field: "password", message: "Passwords do not match." };
    return null;
  };

  const canSendCode =
    !isSendingCode &&
    !isSigningUp &&
    digitsOnly(phone).length === 10 &&
    cooldown === 0;

  const canVerifyCode =
    !isVerifyingCode &&
    !isSigningUp &&
    codeSent &&
    !phoneVerified &&
    digitsOnly(code).length === 6 &&
    digitsOnly(phone).length === 10;

  const canSubmit =
    !isSigningUp &&
    !isSendingCode &&
    !isVerifyingCode &&
    !!norm(firstName) &&
    !!norm(email) &&
    digitsOnly(phone).length === 10 &&
    !!password &&
    !!passwordConfirm &&
    phoneVerified &&
    !!verificationToken;

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open link", url);
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneDisplay(value);
    const priorDigits = digitsOnly(phone);
    const nextDigits = digitsOnly(formatted);

    setPhone(formatted);
    clearFieldErrorsOnEdit("phone");
    setInlineSuccess(null);

    if (nextDigits !== priorDigits) {
      if (phoneVerified) {
        setPhoneVerified(false);
        setVerificationToken("");
        setInlineSuccess(null);
      }

      if (codeSent) {
        setCodeSent(false);
        setCode("");
        setMaskedPhone("");
        setCooldown(0);
      }
    }
  };

  const handleCodeChange = (value: string) => {
    const clean = digitsOnly(value).slice(0, 6);
    setCode(clean);
    clearFieldErrorsOnEdit("code");
    setInlineSuccess(null);
  };

  const handleSendCode = async () => {
    if (!canSendCode) return;

    clearAllErrors();
    setInlineSuccess(null);

    try {
      setIsSendingCode(true);

      const result = await requestPhoneCode(phone);

      if (!result?.ok) {
        setCategorizedError(result?.error || "Could not send verification code.");
        return;
      }

      const nextCooldown = Number(result?.data?.cooldown || 0);

      setCodeSent(true);
      setPhoneVerified(false);
      setVerificationToken("");
      setCode("");
      setMaskedPhone(result?.data?.maskedPhone || "");
      setCooldown(nextCooldown);
      setInlineSuccess("Verification code sent.");
    } catch {
      setPhoneError("Network error while sending code.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!canVerifyCode) return;

    clearAllErrors();
    setInlineSuccess(null);

    try {
      setIsVerifyingCode(true);

      const result = await verifyPhoneCode(phone, code);

      if (!result?.ok) {
        setCategorizedError(result?.error || "Invalid or expired code.");
        return;
      }

      setPhoneVerified(true);
      setVerificationToken(result?.data?.verificationToken || "");
      setInlineSuccess("Phone number verified.");
    } catch {
      setCodeError("Network error while verifying code.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSignUp = async () => {
    if (isSigningUp) return;

    const v = validateClient();

    if (v) {
      clearAllErrors();

      if (v.field === "name") setNameError(v.message);
      if (v.field === "email") setEmailError(v.message);
      if (v.field === "phone") setPhoneError(v.message);
      if (v.field === "code") setCodeError(v.message);
      if (v.field === "password") setPasswordError(v.message);

      if (password && passwordConfirm) {
        setPwHint(password === passwordConfirm ? "match" : "mismatch");
      }
      return;
    }

    try {
      setIsSigningUp(true);
      clearAllErrors();
      setInlineSuccess(null);
      await afterNextPaint();

      await runFillAnim();

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

        await resetFillAnim();
        setIsSigningUp(false);

        const msg = result?.error || "Unable to create account.";
        setCategorizedError(msg);
        return;
      }

      const token = String(result?.data?.token || result?.token || "");
      const user = result?.data?.user || result?.user || null;

      if (!token) {
        await resetFillAnim();
        setIsSigningUp(false);
        Alert.alert("Sign up failed", "Missing token from server.");
        return;
      }

      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("auth_user", JSON.stringify(user || {}));

      await afterNextPaint();
      await letAnimationBeSeen(700);

      await signIn();
      router.replace("/(app)");

      setPassword("");
      setPasswordConfirm("");
      setCode("");
      setVerificationToken("");
    } catch {
      await resetFillAnim();
      setIsSigningUp(false);
      setGeneralError("Network error. Could not reach backend. Check LAN IP, Rails bind, and CORS.");
    }
  };

  const goToSignIn = () => {
    if (isSigningUp) return;
    router.replace("/(auth)/sign-in");
  };

  const hintVisible = pwHint !== "hidden";
  const hintIsMatch = pwHint === "match";

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.logoBannerFullBleed,
            {
              paddingTop: Math.max(insets.top, 10) + (Platform.OS === "android" ? 8 : 0),
              paddingBottom: LOGO_BOTTOM_GAP,
            },
          ]}
          pointerEvents="none"
        >
          <Image source={{ uri: LOGO_URI }} style={styles.logoFullBleed} />
        </View>

        <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.main}>
              <View style={styles.form}>
                <Text style={styles.title}>Sign Up</Text>
                <Text style={styles.subtitle}>Create your account</Text>

                {!!generalError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={20} color={BRAND.danger} />
                    <Text style={styles.errorText}>{generalError}</Text>
                  </View>
                )}

                {!!inlineSuccess && (
                  <View style={styles.successBox}>
                    <Ionicons name="checkmark-circle" size={20} color={BRAND.ok} />
                    <Text style={styles.successText}>{inlineSuccess}</Text>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>First Name</Text>

                  {!!nameError && (
                    <View style={styles.fieldErrorBox}>
                      <Ionicons name="alert-circle" size={16} color={BRAND.danger} />
                      <Text style={styles.fieldErrorText}>{nameError}</Text>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <Ionicons name="person" size={22} color={BRAND.blue} />
                    <TextInput
                      value={firstName}
                      onChangeText={(t) => {
                        setFirstName(t);
                        clearFieldErrorsOnEdit("name");
                      }}
                      placeholder="First name"
                      placeholderTextColor="#b3b5b9a8"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Last Name (optional)</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={22} color={BRAND.blue} />
                    <TextInput
                      value={lastName}
                      onChangeText={(t) => {
                        setLastName(t);
                        clearFieldErrorsOnEdit("name");
                      }}
                      placeholder="Last name"
                      placeholderTextColor="#b3b5b9a8"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>

                  {!!emailError && (
                    <View style={styles.fieldErrorBox}>
                      <Ionicons name="alert-circle" size={16} color={BRAND.danger} />
                      <Text style={styles.fieldErrorText}>{emailError}</Text>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <Ionicons name="mail" size={22} color={BRAND.blue} />
                    <TextInput
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        clearFieldErrorsOnEdit("email");
                      }}
                      placeholder="you@example.com"
                      placeholderTextColor="#b3b5b9a8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                      autoCorrect={false}
                      autoComplete="off"
                      textContentType="none"
                    />
                    {email.trim().length > 0 && (
                      <Ionicons
                        name={looksLikeEmail(email) ? "checkmark-circle" : "close-circle"}
                        size={20}
                        color={looksLikeEmail(email) ? BRAND.ok : BRAND.muted}
                        style={{ opacity: 0.9 }}
                      />
                    )}
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Phone Number</Text>
                  <Text style={styles.helperText}>
                    We’ll text you a 6-digit confirmation code before account creation.
                  </Text>

                  {!!phoneError && (
                    <View style={styles.fieldErrorBox}>
                      <Ionicons name="alert-circle" size={16} color={BRAND.danger} />
                      <Text style={styles.fieldErrorText}>{phoneError}</Text>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <Ionicons name="call" size={22} color={BRAND.blue} />
                    <TextInput
                      value={phone}
                      onChangeText={handlePhoneChange}
                      placeholder="(555) 555-5555"
                      placeholderTextColor="#b3b5b9a8"
                      keyboardType="phone-pad"
                      style={styles.input}
                      editable={!isSigningUp && !isSendingCode && !isVerifyingCode}
                      returnKeyType="next"
                      maxLength={14}
                    />
                    {phoneVerified ? (
                      <Ionicons name="checkmark-circle" size={20} color={BRAND.ok} />
                    ) : digitsOnly(phone).length === 10 ? (
                      <Ionicons name="phone-portrait-outline" size={20} color={BRAND.blue} />
                    ) : null}
                  </View>

                  <View style={styles.phoneActionRow}>
                    <Pressable
                      onPress={handleSendCode}
                      disabled={!canSendCode}
                      style={({ pressed }) => [
                        styles.smallBtn,
                        !canSendCode && styles.smallBtnDisabled,
                        pressed && canSendCode ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Ionicons
                        name="chatbox-ellipses"
                        size={16}
                        color={canSendCode ? BRAND.blue : BRAND.muted}
                      />
                      <Text
                        style={[
                          styles.smallBtnText,
                          !canSendCode && styles.smallBtnTextDisabled,
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
                      <View style={styles.verifiedPill}>
                        <Ionicons name="shield-checkmark" size={14} color={BRAND.ok} />
                        <Text style={styles.verifiedPillText}>Verified</Text>
                      </View>
                    )}
                  </View>

                  {codeSent && !phoneVerified && (
                    <View style={styles.verifyWrap}>
                      <Text style={styles.verifyLabel}>
                        Enter Code
                        {maskedPhone ? ` sent to ${maskedPhone}` : ""}
                      </Text>

                      {!!codeError && (
                        <View style={styles.fieldErrorBox}>
                          <Ionicons name="alert-circle" size={16} color={BRAND.danger} />
                          <Text style={styles.fieldErrorText}>{codeError}</Text>
                        </View>
                      )}

                      <View style={styles.inputRow}>
                        <Ionicons name="key" size={22} color={BRAND.blue} />
                        <TextInput
                          value={code}
                          onChangeText={handleCodeChange}
                          placeholder="6-digit code"
                          placeholderTextColor="#b3b5b9a8"
                          keyboardType="number-pad"
                          style={styles.input}
                          editable={!isSigningUp && !isVerifyingCode}
                          returnKeyType="done"
                          maxLength={6}
                          onSubmitEditing={handleVerifyCode}
                        />
                      </View>

                      <Pressable
                        onPress={handleVerifyCode}
                        disabled={!canVerifyCode}
                        style={({ pressed }) => [
                          styles.verifyBtn,
                          !canVerifyCode && styles.verifyBtnDisabled,
                          pressed && canVerifyCode ? { opacity: 0.92 } : null,
                        ]}
                      >
                        <Ionicons
                          name="shield-checkmark"
                          size={18}
                          color={canVerifyCode ? "#FFFFFF" : "#98A2B3"}
                        />
                        <Text
                          style={[
                            styles.verifyBtnText,
                            !canVerifyCode && styles.verifyBtnTextDisabled,
                          ]}
                        >
                          {isVerifyingCode ? "Verifying..." : "Verify Code"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>

                  {!!passwordError && (
                    <View style={styles.fieldErrorBox}>
                      <Ionicons name="alert-circle" size={16} color={BRAND.danger} />
                      <Text style={styles.fieldErrorText}>{passwordError}</Text>
                    </View>
                  )}

                  <View style={styles.inputRow}>
                    <Ionicons name="lock-closed" size={22} color={BRAND.blue} />
                    <TextInput
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        clearFieldErrorsOnEdit("password");

                        if (pwHint !== "hidden" && passwordConfirm) {
                          setPwHint(t === passwordConfirm ? "match" : "mismatch");
                        }
                      }}
                      secureTextEntry={secure1}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#b3b5b9a8"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                    />
                    <Pressable
                      onPress={() => setSecure1((s) => !s)}
                      disabled={isSigningUp}
                      hitSlop={10}
                    >
                      <Ionicons name={secure1 ? "eye" : "eye-off"} size={22} color={BRAND.muted} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="lock-open" size={22} color={BRAND.blue} />
                    <TextInput
                      value={passwordConfirm}
                      onChangeText={(t) => {
                        setPasswordConfirm(t);
                        clearFieldErrorsOnEdit("password");
                        schedulePwHintCheck(t, 700);
                      }}
                      secureTextEntry={secure2}
                      placeholder="Re-type password"
                      placeholderTextColor="#b3b5b9a8"
                      style={styles.input}
                      editable={!isSigningUp}
                      onSubmitEditing={handleSignUp}
                      returnKeyType="go"
                    />
                    <Pressable
                      onPress={() => setSecure2((s) => !s)}
                      disabled={isSigningUp}
                      hitSlop={10}
                    >
                      <Ionicons name={secure2 ? "eye" : "eye-off"} size={22} color={BRAND.muted} />
                    </Pressable>
                  </View>

                  {hintVisible && (
                    <View style={styles.matchRow}>
                      <Ionicons
                        name={hintIsMatch ? "checkmark-circle" : "alert-circle"}
                        size={16}
                        color={hintIsMatch ? BRAND.ok : BRAND.danger}
                      />
                      <Text
                        style={[
                          styles.matchText,
                          { color: hintIsMatch ? BRAND.ok : BRAND.danger },
                        ]}
                      >
                        {hintIsMatch ? "Passwords match" : "Passwords don’t match"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.legalWrap}>
                  <Text style={styles.legalText}>
                    By signing up, you agree to our{" "}
                    <Text style={styles.legalLink} onPress={() => openUrl(TERMS_URL)}>
                      Terms & Conditions
                    </Text>{" "}
                    and{" "}
                    <Text style={styles.legalLink} onPress={() => openUrl(PRIVACY_POLICY_URL)}>
                      Privacy Policy
                    </Text>
                    . You also agree to receive transactional text messages for verification and
                    support. Message frequency varies. Message and data rates may apply. Reply STOP
                    to opt out and HELP for help.
                  </Text>
                </View>

                <Pressable
                  onPress={handleSignUp}
                  disabled={!canSubmit}
                  onLayout={onPrimaryLayout}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && canSubmit ? { opacity: 0.9 } : null,
                    !canSubmit ? { opacity: 0.7 } : null,
                    isSigningUp ? { opacity: 0.97 } : null,
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.primaryFill,
                      { transform: fillTransform, opacity: isSigningUp ? 0.95 : 0 },
                    ]}
                  />
                  <View style={styles.primaryInner} pointerEvents="none">
                    {isSigningUp ? (
                      <Animated.View style={{ transform: [{ translateX: iconTravel }] }}>
                        <Ionicons name="walk" size={22} color="#FFFFFF" />
                      </Animated.View>
                    ) : (
                      <>
                        <Ionicons name="walk" size={22} color={BRAND.blue} />
                        <Text style={styles.primaryText}>SIGN UP</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={BRAND.blue}
                          style={{ opacity: 0.7 }}
                        />
                      </>
                    )}
                  </View>
                </Pressable>

                <View style={styles.secondaryRow}>
                  <Text style={styles.secondaryText}>Already have an account?</Text>
                  <Pressable onPress={goToSignIn} disabled={isSigningUp} hitSlop={10}>
                    <Text style={styles.secondaryLink}>Sign In</Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ height: 18 }} />
            </View>
          </ScrollView>

          {!keyboardOpen && (
            <View style={styles.footer}>
              <Ionicons name="shield-checkmark" size={22} color={BRAND.blue} />
              <Text style={styles.footerText}>
                Mom&apos;s Scam Helpline{"\n"}Since 2<Text style={styles.footerZero}>0</Text>13
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.pageBg },

  logoBannerFullBleed: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    aspectRatio: LOGO_ASPECT_RATIO,
    overflow: "hidden",
  },

  logoFullBleed: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: H_PADDING,
    marginTop: 0,
  },

  scrollContent: { flexGrow: 1, justifyContent: "center" },
  main: { width: "100%" },

  form: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 18,
  },

  title: { fontSize: 26, fontFamily: FONT.semi, color: BRAND.text },
  subtitle: {
    color: BRAND.muted,
    marginTop: 4,
    marginBottom: 12,
    fontFamily: FONT.regular,
  },

  field: { marginTop: 12 },
  label: { fontSize: 13, fontFamily: FONT.medium, color: BRAND.text },

  helperText: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 16,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: BRAND.dangerSoft,
    borderWidth: 1,
    borderColor: "#FEE4E2",
    marginBottom: 10,
  },
  errorText: {
    flex: 1,
    color: BRAND.danger,
    fontFamily: FONT.medium,
    fontSize: 14,
    lineHeight: 18,
  },

  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: BRAND.okSoft,
    borderWidth: 1,
    borderColor: "#D1FADF",
    marginBottom: 10,
  },
  successText: {
    flex: 1,
    color: BRAND.ok,
    fontFamily: FONT.medium,
    fontSize: 14,
    lineHeight: 18,
  },

  fieldErrorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BRAND.dangerSoft,
    borderWidth: 1,
    borderColor: "#FEE4E2",
    marginTop: 8,
  },
  fieldErrorText: {
    flex: 1,
    color: BRAND.danger,
    fontFamily: FONT.medium,
    fontSize: 13,
    lineHeight: 17,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    backgroundColor: BRAND.inputBg,
    marginTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: BRAND.text,
    fontFamily: FONT.regular,
    paddingVertical: 0,
  },

  phoneActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  smallBtnDisabled: {
    borderColor: BRAND.border,
    backgroundColor: "#F8FAFC",
  },
  smallBtnText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 13,
  },
  smallBtnTextDisabled: {
    color: BRAND.muted,
  },

  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BRAND.okSoft,
    borderWidth: 1,
    borderColor: "#D1FADF",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  verifiedPillText: {
    color: BRAND.ok,
    fontFamily: FONT.medium,
    fontSize: 13,
  },

  verifyWrap: {
    marginTop: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    borderRadius: 18,
  },

  verifyLabel: {
    fontFamily: FONT.medium,
    color: BRAND.text,
    fontSize: 13,
  },

  verifyBtn: {
    marginTop: 12,
    backgroundColor: BRAND.blue,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  verifyBtnDisabled: {
    backgroundColor: "#E4E7EC",
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.semi,
    fontSize: 14,
    letterSpacing: 0.4,
  },
  verifyBtnTextDisabled: {
    color: "#98A2B3",
  },

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  matchText: { fontFamily: FONT.medium, fontSize: 13 },

  legalWrap: {
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    borderRadius: 16,
  },
  legalText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  legalLink: {
    color: BRAND.blue,
    fontFamily: FONT.semi,
    textDecorationLine: "underline",
  },

  primaryBtn: {
    marginTop: 16,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },
  primaryFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: BRAND.blue,
  },
  primaryInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  primaryText: {
    fontFamily: FONT.medium,
    fontSize: 16,
    letterSpacing: 1,
    color: BRAND.text,
  },

  secondaryRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  secondaryText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
  },
  secondaryLink: {
    color: BRAND.blue,
    fontFamily: FONT.semi,
    fontSize: 14,
  },

  footer: {
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
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
});