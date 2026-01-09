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

const FONT = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semi: "Inter-SemiBold",
};

const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766530533/NON_M_copy_2_3_poheb7.jpg";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

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

  const fillAnim = useRef(new Animated.Value(0)).current;
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const iconTravel = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  const runFillAnim = () =>
    new Promise<void>((resolve) => {
      fillAnim.setValue(0);
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => resolve());
    });

  const handleSignIn = async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);
      await runFillAnim();

      const { ok, status, json } = await postJson("/v1/auth/login", {
        user: {
          email: email.trim().toLowerCase(),
          password: password.trim(),
        },
      });

      if (!ok) {
        await SecureStore.deleteItemAsync("auth_token");
        await SecureStore.deleteItemAsync("auth_user");

        Alert.alert(
          "Login failed",
          json?.error ? `${json.error} (HTTP ${status})` : `HTTP ${status}`
        );
        return;
      }

      const token = String(json?.token || "");
      if (!token) {
        Alert.alert("Login failed", "Missing token from server.");
        return;
      }

      await SecureStore.setItemAsync("auth_token", token);
      await SecureStore.setItemAsync(
        "auth_user",
        JSON.stringify(json?.user || {})
      );

      // ✅ THIS is what stops the "bounce back to sign-in"
      await signIn();

      setPassword("");
      router.replace("/(app)");
    } catch {
      Alert.alert(
        "Network error",
        "Could not reach backend. Check LAN IP, Rails bind, and CORS."
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
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
                      keyboardType="email-address"
                      style={styles.input}
                      editable={!isSigningIn}
                      returnKeyType="next"
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
                      editable={!isSigningIn}
                      onSubmitEditing={handleSignIn}
                      returnKeyType="go"
                    />
                    <Pressable
                      onPress={() => setSecure((s) => !s)}
                      disabled={isSigningIn}
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

                <Pressable
                  onPress={handleSignIn}
                  disabled={isSigningIn}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && !isSigningIn ? { opacity: 0.9 } : null,
                    isSigningIn ? { opacity: 0.95 } : null,
                  ]}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.primaryFill, { width: fillWidth }]}
                  />
                  <View style={styles.primaryInner} pointerEvents="none">
                    {isSigningIn ? (
                      <Animated.View
                        style={[
                          styles.primaryIconPill,
                          {
                            transform: [{ translateX: iconTravel }],
                            marginHorizontal: "auto",
                          },
                        ]}
                      >
                        <Ionicons name="walk" size={22} color="#FFFFFF" />
                      </Animated.View>
                    ) : (
                      <>
                        <View style={styles.primaryInner}>
                          <Ionicons name="walk" size={22} color={BRAND.blue} />
                        </View>

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

              <View style={{ height: 18 }} />
            </View>
          </ScrollView>

          {!keyboardOpen && (
            <View style={styles.footer}>
              <Ionicons name="shield-checkmark" size={22} color={BRAND.blue} />
              <Text style={styles.footerText}>Scam Helpline</Text>
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

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },

  main: {
    width: "100%",
  },

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

  primaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  primaryText: {
    fontFamily: FONT.medium,
    fontSize: 16,
    letterSpacing: 1,
    color: BRAND.text,
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
  },
});
