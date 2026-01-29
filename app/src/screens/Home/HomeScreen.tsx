import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { useAuth } from "../../auth/AuthProvider";
import { postJson } from "../../services/api/client";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
};

const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1769703507/ChatGPT_Image_Jan_29_2026_08_00_07_AM_1_3_gtqeo8.jpg";

function AnimatedHint() {
  // Sheen sweep
  const sheenX = useRef(new Animated.Value(-140)).current;
  const sheenOpacity = useRef(new Animated.Value(0)).current;

  // Icon pop + wiggle
  const iconScale = useRef(new Animated.Value(0.92)).current;
  const iconRotate = useRef(new Animated.Value(0)).current;

  // Line 1
  const l1Opacity = useRef(new Animated.Value(0)).current;
  const l1Y = useRef(new Animated.Value(10)).current;
  const l1Scale = useRef(new Animated.Value(0.985)).current;

  // Line 2
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
          // Sheen sweep
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

          // Icon pop + tiny wiggle
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

          // Line 1
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

          // Line 2
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
  }, []);

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
            ask Mom first before you click
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const handleLogout = () => {
    if (isLoggingOut) return;

    Alert.alert(
      "Log out?",
      "You’ll need to sign in again to use Ask Mom.",
      [
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

              await signOut();
              router.replace("/(auth)/sign-in");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const MOM_PHONE = "+15625551234"; // TODO: replace with real number

  const handleCallMom = () => {
    Alert.alert(
      "Call Mom?",
      "This will place a phone call using your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          style: "default",
          onPress: () => {
            Linking.openURL(`tel:${MOM_PHONE}`).catch(() => {
              Alert.alert(
                "Unable to place call",
                "Your device couldn’t start a phone call."
              );
            });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const bigBtnTextStyle = useMemo(
    () => [styles.bigBtnText, isNarrow && styles.bigBtnTextNarrow],
    [isNarrow]
  );

  // Footer sizing
  const FOOTER_MIN_HEIGHT = 56;
  const footerPaddingBottom = Math.max(insets.bottom, 10) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  return (
    // ✅ Use safe-area-context SafeAreaView and DO NOT double-apply insets on iOS
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={[styles.screen, { paddingTop: 8, paddingBottom: 10 }]}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            hitSlop={12}
            style={({ pressed }) => [
              styles.logoutChip,
              pressed && !isLoggingOut && styles.logoutChipPressed,
              isLoggingOut && { opacity: 0.6 },
            ]}
          >
            {isLoggingOut ? (
              <>
                <ActivityIndicator size="small" color={BRAND.blue} />
                <Text style={styles.logoutChipText}>Logging out…</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="walk"
                  size={22}
                  color={BRAND.blue}
                  style={{ transform: [{ scaleX: -1 }] }}
                />
                <Text style={styles.logoutChipText}>Logout</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Reserve space so footer never collides */}
        <View style={[styles.main, { paddingBottom: footerTotalHeight }]}>
          <View style={[styles.row, styles.rowFullBleed]}>
            <View style={styles.bannerRow}>
              <View style={styles.logoBanner} pointerEvents="none">
                <Image
                  source={{ uri: LOGO_URI }}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>

          <AnimatedHint />

          <View style={[styles.actionsWrap, { paddingTop: 4 }]}>
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push("/(app)/ask-mom")}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={34}
                    color={BRAND.blue}
                  />
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
                  <Text style={styles.btnSubText}>
                    When something doesn’t feel right
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(app)/text-mom")}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="mail" size={34} color={BRAND.blue} />
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
                    For non-urgent questions
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleCallMom}
                disabled={isLoggingOut}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && !isLoggingOut && styles.bigBtnPressed,
                  isLoggingOut && styles.disabledBtn,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="call" size={34} color={BRAND.blue} />
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
                    When you need to talk to a real person
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
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
          <Ionicons name="home" size={24} color={BRAND.blue} />
          <Text style={styles.footerText}>Home</Text>
        </View>

        {isLoggingOut && (
          <View style={styles.logoutOverlay} pointerEvents="auto">
            <View style={styles.logoutModal}>
              <ActivityIndicator size="large" color={BRAND.blue} />
              <Text style={styles.logoutTitle}>Logging out…</Text>
              <Text style={styles.logoutSub}>
                Securing your session and signing you out.
              </Text>
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
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 6,
  },

  logoutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  logoutChipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  logoutChipText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 14,
    letterSpacing: 0.35,
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
    marginTop: 10,
    marginBottom: 14,
    width: "100%",
  },

  hintCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
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
    fontSize: 14,
    letterSpacing: 0.1,
  },

  hintLineSecondary: {
    marginTop: 3,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 17,
  },

  actionsWrap: { flex: 1, justifyContent: "flex-start" },

  actions: { width: "100%", gap: 12 },

  bigBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  bigBtnPressed: { transform: [{ scale: 0.99 }], opacity: 0.98 },

  disabledBtn: { opacity: 0.55 },

  iconPill: {
    width: 64,
    height: 40,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  textWrap: {
    flex: 1,
    minWidth: 0,
  },

  bigBtnText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 24,
    letterSpacing: 1.0,
    flexShrink: 1,
  },

  bigBtnTextNarrow: { letterSpacing: 0.4 },

  btnSubText: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    alignItems: "center",
    justifyContent: "center",

    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,

    backgroundColor: BRAND.screenBg,
  },

  footerText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    letterSpacing: 0.25,
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
    paddingVertical: 18,
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
    fontSize: 18,
    letterSpacing: 0.3,
  },

  logoutSub: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 18,
  },
});
