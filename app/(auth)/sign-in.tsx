// app/(auth)/sign-in.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "./../src/auth/AuthProvider";

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
  inputBorder: "#D7DEE8",
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
  const { signInMock } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Animated "fill to the right" + icon travel
  const fillAnim = useRef(new Animated.Value(0)).current; // 0..1
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const iconTravel = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120], // pushes icon right (tuned below via maxWidth)
  });

  useEffect(() => {
    // Reset animation when leaving signing-in state
    if (!isSigningIn) {
      fillAnim.setValue(0);
    }
  }, [isSigningIn, fillAnim]);

  const runFillAnim = () =>
    new Promise<void>((resolve) => {
      fillAnim.setValue(0);
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width animation requires false
      }).start(() => resolve());
    });

  const handleSignIn = async () => {
    if (isSigningIn) return;

    try {
      setIsSigningIn(true);
      await runFillAnim();

      if (typeof signInMock === "function") {
        await signInMock(email, password);
      }
    } catch {
      // ignore for now
    } finally {
      router.replace("/");
      // If navigation ever fails, at least unlock after a beat
      setTimeout(() => setIsSigningIn(false), 500);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          <View style={styles.main}>
            {/* LOGO */}
            <View style={[styles.row, styles.rowFullBleed]}>
              <View style={styles.bannerRow}>
                <View style={styles.logoBanner}>
                  <Image source={{ uri: LOGO_URI }} style={styles.logo} />
                </View>
              </View>
            </View>

            {/* FORM */}
            <View style={styles.formWrap}>
              <View style={styles.form}>
                <View style={styles.head}>
                  <Text style={styles.title}>Sign In</Text>
                  <Text style={styles.subtitle}>Welcome back</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputRow}>
                    <View style={styles.leftIconPill}>
                      <Ionicons name="mail" size={22} color={BRAND.blue} />
                    </View>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      placeholderTextColor={BRAND.muted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      editable={!isSigningIn}
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Password</Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert("Coming soon", "Password reset soon.")
                      }
                      style={({ pressed }) => pressed && { opacity: 0.75 }}
                      disabled={isSigningIn}
                    >
                      <Text style={styles.link}>Forgot?</Text>
                    </Pressable>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.leftIconPill}>
                      <Ionicons
                        name="lock-closed"
                        size={22}
                        color={BRAND.blue}
                      />
                    </View>

                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor={BRAND.muted}
                      secureTextEntry={secure}
                      style={styles.input}
                      onSubmitEditing={handleSignIn}
                      editable={!isSigningIn}
                    />

                    <Pressable
                      onPress={() => setSecure((s) => !s)}
                      style={styles.rightIconBtn}
                      hitSlop={10}
                      disabled={isSigningIn}
                    >
                      <Ionicons
                        name={secure ? "eye" : "eye-off"}
                        size={22}
                        color={BRAND.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* ✅ Fill-to-right Sign In */}
                <Pressable
                  onPress={handleSignIn}
                  hitSlop={12}
                  disabled={isSigningIn}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && !isSigningIn && styles.primaryBtnPressed,
                    isSigningIn && styles.primaryBtnSigning,
                  ]}
                >
                  {/* Animated blue fill that grows to the right */}
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.primaryFill, { width: fillWidth }]}
                  />

                  {/* Content row */}
                  <View style={styles.primaryInner} pointerEvents="none">
                    {/* The icon "travels" to the right with the fill */}
                    <Animated.View
                      style={[
                        styles.primaryIconPill,
                        { transform: [{ translateX: iconTravel }] },
                      ]}
                    >
                      {/* “walking in” vibe */}
                      <Ionicons
                        name="walk"
                        size={22}
                        color={isSigningIn ? "#FFFFFF" : BRAND.blue}
                        style={
                          isSigningIn ? undefined : { transform: [{ scaleX: 1 }] }
                        }
                      />
                    </Animated.View>

                    <Text
                      style={[
                        styles.primaryBtnText,
                        isSigningIn && styles.primaryBtnTextSigning,
                      ]}
                    >
                      SIGN IN
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={isSigningIn ? "#FFFFFF" : BRAND.blue}
                      style={{ opacity: isSigningIn ? 0.95 : 0.7 }}
                    />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark" size={22} color={BRAND.blue} />
            <Text style={styles.footerText}>Scam Helpline</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: H_PADDING,
  },

  main: { flex: 1 },

  row: { width: "100%" },
  rowFullBleed: { alignSelf: "stretch" },
  bannerRow: { width: "100%" },

  logoBanner: {
    marginLeft: -H_PADDING,
    marginRight: -H_PADDING,
    aspectRatio: LOGO_ASPECT_RATIO,
    borderRadius: 14,
    overflow: "hidden",
  },

  logo: { width: "100%", height: "100%" },

  formWrap: { flex: 1, justifyContent: "center" },

  form: {
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    padding: 18,
  },

  head: { marginBottom: 14 },

  title: {
    fontFamily: FONT.semi,
    fontSize: 26,
    color: BRAND.text,
  },

  subtitle: {
    fontFamily: FONT.regular,
    fontSize: 14,
    color: BRAND.muted,
  },

  field: { marginTop: 12 },

  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  label: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: BRAND.text,
  },

  link: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: BRAND.blue,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingVertical: Platform.OS === "ios" ? 16 : 12,
    paddingHorizontal: 14,
    backgroundColor: BRAND.inputBg,
  },

  leftIconPill: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  input: {
    flex: 1,
    fontFamily: FONT.regular,
    fontSize: 16,
    color: BRAND.text,
    paddingVertical: 0,
  },

  rightIconBtn: { padding: 6, borderRadius: 12 },

  /* ✅ Fill-to-right button */
  primaryBtn: {
    marginTop: 14,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  primaryBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },

  primaryBtnSigning: {
    borderColor: BRAND.blue,
  },

  // Blue fill layer
  primaryFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: BRAND.blue,
    opacity: 0.95,
  },

  // Content padding stays consistent while fill animates underneath
  primaryInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  primaryIconPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    overflow: "hidden",
  },

  primaryBtnText: {
    fontFamily: FONT.medium,
    fontSize: 16,
    letterSpacing: 0.8,
    color: BRAND.text,
  },

  primaryBtnTextSigning: {
    color: "#FFFFFF",
  },

  footer: {
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
  },

  footerText: {
    fontFamily: FONT.regular,
    fontSize: 14,
    color: BRAND.muted,
  },
});
