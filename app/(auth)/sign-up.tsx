// app/(auth)/sign-up.tsx
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
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { postJson } from "../src/services/api/client";
import { FONT } from "../src/theme";

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
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766530533/NON_M_copy_2_3_poheb7.jpg";

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

function parseRailsErrors(json: any): string[] {
  const details = json?.details;
  if (Array.isArray(details)) return details.map((x) => String(x));
  if (typeof details === "string") return [details];
  return [];
}

function isEmailTaken(errors: string[]) {
  const j = errors.join(" ").toLowerCase();
  return j.includes("email") && j.includes("taken");
}

function pickBestErrorMessage(json: any, status: number): string {
  const errs = parseRailsErrors(json);
  if (errs.length) {
    if (isEmailTaken(errs)) return "An account with this email already exists.";
    const first = errs[0];
    if (/password/i.test(first) && /blank|empty|can't/i.test(first))
      return "Please create a password.";
    if (/password/i.test(first) && /confirmation/i.test(first))
      return "Passwords do not match.";
    if (/email/i.test(first) && /blank|empty|can't/i.test(first))
      return "Please enter your email.";
    return first;
  }

  if (json?.error) {
    if (json.error === "validation_error") return "Please double-check your info.";
    return `${String(json.error)} (HTTP ${status})`;
  }

  return `Sign up failed (HTTP ${status}).`;
}

// Wait a couple frames (forces RN to paint updated state)
function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

// Wait until current interactions/animations settle, then pause briefly
function letAnimationBeSeen(ms: number): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => resolve(), ms);
    });
  });
}

type PwHintState = "hidden" | "match" | "mismatch";

export default function SignUpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);

  const [isSigningUp, setIsSigningUp] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Inline error message (senior-friendly)
  const [inlineError, setInlineError] = useState<string | null>(null);

  // ✅ Debounced hint: show after pause, match or mismatch
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

  const schedulePwHintCheck = (nextConfirm: string, delayMs = 700) => {
    if (confirmTypingTimerRef.current) {
      clearTimeout(confirmTypingTimerRef.current);
      confirmTypingTimerRef.current = null;
    }

    // while typing, hide any hint
    setPwHint("hidden");

    confirmTypingTimerRef.current = setTimeout(() => {
      const pw = String(password || "");
      const pc = String(nextConfirm || "");

      // Only show a hint once both fields have content
      if (!pw || !pc) {
        setPwHint("hidden");
        return;
      }

      setPwHint(pw === pc ? "match" : "mismatch");
    }, delayMs);
  };

  // ===== Animation (FIX) =====
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

    if (!fn) return "Please enter your first name.";
    if (!em) return "Please enter your email.";
    if (!looksLikeEmail(em)) return "That email doesn’t look right.";
    if (!pw) return "Please create a password.";
    if (pw.length < 8) return "Password must be at least 8 characters.";
    if (!pc) return "Please re-type your password.";
    if (pw !== pc) return "Passwords do not match.";
    return null;
  };

  const canSubmit =
    !isSigningUp && !!norm(firstName) && !!norm(email) && !!password && !!passwordConfirm;

  const handleSignUp = async () => {
    if (isSigningUp) return;

    const v = validateClient();
    if (v) {
      setInlineError(v);

      // if submit attempted and both present, show immediate hint
      if (password && passwordConfirm) {
        setPwHint(password === passwordConfirm ? "match" : "mismatch");
      }
      return;
    }

    try {
      setIsSigningUp(true);
      setInlineError(null);
      await afterNextPaint();

      await runFillAnim();

      const { ok, status, json } = await postJson("/v1/auth/signup", {
        user: {
          email: normEmail(email),
          password: String(password || "").trim(),
          password_confirmation: String(passwordConfirm || "").trim(),
          first_name: norm(firstName),
          last_name: norm(lastName) || undefined,
        },
      });

      if (!ok) {
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("auth_user");

        await resetFillAnim();
        setIsSigningUp(false);

        const msg = pickBestErrorMessage(json, status);
        setInlineError(msg);

        if (status >= 500 || status === 0) {
          Alert.alert("Sign up failed", msg);
        }
        return;
      }

      const token = String(json?.token || "");
      if (!token) {
        await resetFillAnim();
        setIsSigningUp(false);
        Alert.alert("Sign up failed", "Missing token from server.");
        return;
      }

      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("auth_user", JSON.stringify(json?.user || {}));

      await afterNextPaint();
      await letAnimationBeSeen(700);

      await signIn();
      router.replace("/(app)");

      setPassword("");
      setPasswordConfirm("");
    } catch {
      await resetFillAnim();
      setIsSigningUp(false);

      Alert.alert(
        "Network error",
        "Could not reach backend. Check LAN IP, Rails bind, and CORS."
      );
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
            styles.screen,
            {
              paddingTop: Math.max(insets.top, 10),
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.main}>
              <View style={styles.logoBanner}>
                <Image source={{ uri: LOGO_URI }} style={styles.logo} />
              </View>

              <View style={styles.form}>
                <Text style={styles.title}>Sign Up</Text>
                <Text style={styles.subtitle}>Create your account</Text>

                {!!inlineError && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={20} color={BRAND.danger} />
                    <Text style={styles.errorText}>{inlineError}</Text>
                  </View>
                )}

                <View style={styles.field}>
                  <Text style={styles.label}>First Name</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person" size={22} color={BRAND.blue} />
                    <TextInput
                      value={firstName}
                      onChangeText={(t) => {
                        setFirstName(t);
                        if (inlineError) setInlineError(null);
                      }}
                      placeholder="First name"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Last Name (optional)</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="person-outline" size={22} color={BRAND.blue} />
                    <TextInput
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last name"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="mail" size={22} color={BRAND.blue} />
                    <TextInput
                      value={email}
                      onChangeText={(t) => {
                        setEmail(t);
                        if (inlineError) setInlineError(null);
                      }}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
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
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="lock-closed" size={22} color={BRAND.blue} />
                    <TextInput
                      value={password}
                      onChangeText={(t) => {
                        setPassword(t);
                        if (inlineError) setInlineError(null);

                        // If they already got a hint and then edit password, keep it accurate
                        if (pwHint !== "hidden" && passwordConfirm) {
                          setPwHint(t === passwordConfirm ? "match" : "mismatch");
                        }
                      }}
                      secureTextEntry={secure1}
                      placeholder="At least 8 characters"
                      style={styles.input}
                      editable={!isSigningUp}
                      returnKeyType="next"
                    />
                    <Pressable
                      onPress={() => setSecure1((s) => !s)}
                      disabled={isSigningUp}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={secure1 ? "eye" : "eye-off"}
                        size={22}
                        color={BRAND.muted}
                      />
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
                        if (inlineError) setInlineError(null);
                        schedulePwHintCheck(t, 700);
                      }}
                      secureTextEntry={secure2}
                      placeholder="Re-type password"
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
                      <Ionicons
                        name={secure2 ? "eye" : "eye-off"}
                        size={22}
                        color={BRAND.muted}
                      />
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
                      {
                        transform: fillTransform,
                        opacity: isSigningUp ? 0.95 : 0,
                      },
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
                Mom&apos;s Scam Helpline{"\n"}Since 2
                <Text style={styles.footerZero}>0</Text>
                13
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
  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
  },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  main: { width: "100%" },
  logoBanner: {
    width: "100%",
    aspectRatio: 2.3,
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
  },
  logo: { width: "100%", height: "100%" },

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

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  matchText: { fontFamily: FONT.medium, fontSize: 13 },

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
