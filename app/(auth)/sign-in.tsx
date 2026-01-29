// app/(auth)/sign-in.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
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
import { FONT } from "../src/theme"; // ✅ add this

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
};


const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766530533/NON_M_copy_2_3_poheb7.jpg";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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

function pickFriendlyAuthError(status: number, json: any) {
  const raw = String(json?.error || json?.message || "").toLowerCase();

  // Most common auth failure
  if (status === 401 || raw.includes("invalid") || raw.includes("unauthorized")) {
    return "That email or password doesn’t look right. Please try again.";
  }

  if (status === 404) {
    return "We couldn’t find an account with that email.";
  }

  if (status === 422) {
    // validation-ish
    if (raw.includes("email")) return "Please enter a valid email address.";
    if (raw.includes("password")) return "Please enter your password.";
    return "Please double-check your info and try again.";
  }

  if (status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }

  if (status >= 500) {
    return "Our server is having trouble right now. Please try again in a moment.";
  }

  // network / unknown
  if (status === 0) {
    return "We couldn’t reach the server. Please check your connection and try again.";
  }

  return "Something went wrong. Please try again.";
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoingToSignUp, setIsGoingToSignUp] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const anyBusy = isSigningIn || isGoingToSignUp;

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // =========================
  // SIGN IN animation (only)
  // =========================
  const signInFillAnim = useRef(new Animated.Value(0)).current;
  const signInFillWidth = signInFillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const signInIconAnim = useRef(new Animated.Value(0)).current;
  const signInIconX = signInIconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  const runSignInAnim = () =>
    new Promise<void>((resolve) => {
      signInFillAnim.stopAnimation();
      signInIconAnim.stopAnimation();

      signInFillAnim.setValue(0);
      signInIconAnim.setValue(0);

      Animated.parallel([
        Animated.timing(signInFillAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // width
        }),
        Animated.timing(signInIconAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true, // transform
        }),
      ]).start(() => resolve());
    });

  const resetSignInAnim = () =>
    new Promise<void>((resolve) => {
      signInFillAnim.stopAnimation();
      signInIconAnim.stopAnimation();

      Animated.parallel([
        Animated.timing(signInFillAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(signInIconAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  // =========================
  // SIGN UP animation (only)
  // - icon moves INTO CENTER and STOPS
  // - no running off-screen
  // =========================
  const signUpFillAnim = useRef(new Animated.Value(0)).current;
  const signUpFillWidth = signUpFillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const signUpIconAnim = useRef(new Animated.Value(0)).current;
  const signUpIconX = signUpIconAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-28, 0],
  });

  const runSignUpAnim = () =>
    new Promise<void>((resolve) => {
      signUpFillAnim.stopAnimation();
      signUpIconAnim.stopAnimation();

      signUpFillAnim.setValue(0);
      signUpIconAnim.setValue(0);

      Animated.parallel([
        Animated.timing(signUpFillAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false, // width
        }),
        Animated.timing(signUpIconAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true, // transform
        }),
      ]).start(() => resolve());
    });

  const resetSignUpAnim = () =>
    new Promise<void>((resolve) => {
      signUpFillAnim.stopAnimation();
      signUpIconAnim.stopAnimation();

      Animated.parallel([
        Animated.timing(signUpFillAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(signUpIconAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  const hardStopAllAnims = () => {
    signInFillAnim.stopAnimation();
    signInIconAnim.stopAnimation();
    signUpFillAnim.stopAnimation();
    signUpIconAnim.stopAnimation();
  };

  const handleSignIn = async () => {
    if (anyBusy) return;

    const em = normEmail(email);
    const pw = String(password || "");

    if (!em) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }
    if (!looksLikeEmail(em)) {
      Alert.alert("Check your email", "Please enter a valid email address.");
      return;
    }
    if (!pw) {
      Alert.alert("Missing password", "Please enter your password.");
      return;
    }

    try {
      hardStopAllAnims();
      signUpFillAnim.setValue(0);
      signUpIconAnim.setValue(0);

      setIsSigningIn(true);
      await sleep(60);

      await runSignInAnim();

      const { ok, status, json } = await postJson("/v1/auth/login", {
        user: {
          email: em,
          password: pw.trim(),
        },
      });

      if (!ok) {
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("auth_user");
        await resetSignInAnim();
        setIsSigningIn(false);

        Alert.alert("Can’t sign in", pickFriendlyAuthError(status, json));
        return;
      }

      const token = String(json?.token || "");
      if (!token) {
        await resetSignInAnim();
        setIsSigningIn(false);
        Alert.alert("Can’t sign in", "We couldn’t sign you in. Please try again.");
        return;
      }

      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync("auth_user", JSON.stringify(json?.user || {}));

      await sleep(200);

      await signIn();
      setPassword("");
      router.replace("/(app)");
    } catch {
      await resetSignInAnim();
      setIsSigningIn(false);

      Alert.alert(
        "Can’t connect",
        "We couldn’t reach the server right now. Please check your connection and try again."
      );
    }
  };

  const goToSignUp = async () => {
    if (anyBusy) return;

    try {
      hardStopAllAnims();
      signInFillAnim.setValue(0);
      signInIconAnim.setValue(0);

      setIsGoingToSignUp(true);
      await sleep(60);

      await runSignUpAnim();
      await sleep(200);

      router.replace("/(auth)/sign-up");
    } catch {
      await resetSignUpAnim();
      setIsGoingToSignUp(false);
    }
  };

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
                <Text style={styles.title}>Sign In</Text>
                <Text style={styles.subtitle}>Welcome back</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="mail" size={22} color={BRAND.blue} />
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      style={styles.input}
                      editable={!anyBusy}
                      returnKeyType="next"
                      textContentType="username"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputRow}>
                    <Ionicons name="lock-closed" size={22} color={BRAND.blue} />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={secure}
                      placeholder="••••••••"
                      style={styles.input}
                      editable={!anyBusy}
                      onSubmitEditing={handleSignIn}
                      returnKeyType="go"
                      // ✅ do NOT auto-capitalize passwords
                      autoCapitalize="none"
                      autoCorrect={false}
                      textContentType="password"
                    />
                    <Pressable
                      onPress={() => setSecure((s) => !s)}
                      disabled={anyBusy}
                      hitSlop={10}
                    >
                      <Ionicons
                        name={secure ? "eye" : "eye-off"}
                        size={22}
                        color={BRAND.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* SIGN IN button */}
                <Pressable
                  onPress={handleSignIn}
                  disabled={anyBusy}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && !anyBusy ? { opacity: 0.9 } : null,
                    anyBusy ? { opacity: 0.95 } : null,
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.primaryFill,
                      {
                        width: signInFillWidth,
                        opacity: isSigningIn ? 0.95 : 0,
                      },
                    ]}
                  />
                  <View style={styles.primaryInner} pointerEvents="none">
                    {isSigningIn ? (
                      <Animated.View style={{ transform: [{ translateX: signInIconX }] }}>
                        <Ionicons name="walk" size={22} color="#FFFFFF" />
                      </Animated.View>
                    ) : (
                      <>
                        <Ionicons name="walk" size={22} color={BRAND.blue} />
                        <Text style={styles.primaryText}>SIGN IN</Text>
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
              </View>

              {/* SIGN UP row */}
              <View style={styles.newMemberRow}>
                <Text style={styles.newMemberText}>New member?</Text>

                <Pressable
                  onPress={goToSignUp}
                  disabled={anyBusy}
                  hitSlop={10}
                  style={({ pressed }) => [
                    styles.newMemberBtn,
                    pressed && !anyBusy ? { opacity: 0.9 } : null,
                    anyBusy ? { opacity: 0.75 } : null,
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.newMemberFill,
                      {
                        width: signUpFillWidth,
                        opacity: isGoingToSignUp ? 0.95 : 0,
                      },
                    ]}
                  />
                  <View style={styles.newMemberInner} pointerEvents="none">
                    {isGoingToSignUp ? (
                      <Animated.View style={{ transform: [{ translateX: signUpIconX }] }}>
                        <Ionicons name="person-add" size={18} color="#FFFFFF" />
                      </Animated.View>
                    ) : (
                      <>
                        <Ionicons name="person-add" size={18} color={BRAND.blue} />
                        <Text style={styles.newMemberBtnText}>Sign Up</Text>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={BRAND.blue}
                          style={{ opacity: 0.7 }}
                        />
                      </>
                    )}
                  </View>
                </Pressable>
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
    top: 0,
    bottom: 0,
    backgroundColor: BRAND.blue,
    opacity: 0.95,
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

  newMemberRow: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newMemberText: {
    fontSize: 14,
    color: BRAND.muted,
    fontFamily: FONT.regular,
  },
  newMemberBtn: {
    position: "relative",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },
  newMemberFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: BRAND.blue,
    opacity: 0.95,
    borderRadius: 999,
  },
  newMemberInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newMemberBtnText: {
    fontSize: 14,
    color: BRAND.text,
    fontFamily: FONT.medium,
    letterSpacing: 0.6,
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
