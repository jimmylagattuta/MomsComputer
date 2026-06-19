// app/src/screens/PublicAskMomLanding/PublicAskMomLanding.tsx
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getCustomerInfo,
  isProActive,
  restorePurchases,
} from "../../subscriptions/rcClient";
import { FONT } from "../../theme";

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
              transform: [{ translateX: sheenX }, { rotate: "18deg" }],
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

  useLayoutEffect(() => {
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
      style={[styles.premiumPerch, { transform: [{ scale: pulse }] }]}
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

export default function PublicAskMomLanding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const [premiumChecking, setPremiumChecking] = useState(true);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [hasPremiumAccess, setHasPremiumAccess] = useState(false);
  const [activeEntitlementKeys, setActiveEntitlementKeys] = useState<string[]>([]);

  const bigBtnTextStyle = useMemo(
    () => [styles.bigBtnText, isNarrow && styles.bigBtnTextNarrow],
    [isNarrow]
  );

  const FOOTER_MIN_HEIGHT = 64;
  const footerPaddingBottom = Math.max(insets.bottom, 10) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  const refreshPremiumState = useCallback(async (source: string) => {
    try {
      console.log("💳 [PublicLanding] refresh premium state started:", source);

      setPremiumChecking(true);

      const info = await getCustomerInfo();
      const activeKeys = Object.keys(info?.entitlements?.active ?? {});
      const entitlementPro = isProActive(info);
      const anyActiveEntitlement = activeKeys.length > 0;
      const premiumDetected = entitlementPro || anyActiveEntitlement;

      console.log("💳 [PublicLanding] CustomerInfo:", {
        source,
        originalAppUserId: info?.originalAppUserId,
        activeKeys,
        entitlementPro,
        anyActiveEntitlement,
        premiumDetected,
      });

      setActiveEntitlementKeys(activeKeys);
      setHasPremiumAccess(premiumDetected);
    } catch (error) {
      console.log("💳 [PublicLanding] premium state failed:", source, error);

      setActiveEntitlementKeys([]);
      setHasPremiumAccess(false);
    } finally {
      setPremiumChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshPremiumState("mount");
  }, [refreshPremiumState]);

  useFocusEffect(
    useCallback(() => {
      refreshPremiumState("focus");
    }, [refreshPremiumState])
  );

  const goToSignIn = () => {
    router.push("/(auth)/sign-in" as any);
  };

  const goToSignUp = (featureName?: string) => {
    router.push({
      pathname: "/(auth)/sign-up",
      params: {
        intent: "premium_account_setup",
        ...(featureName ? { feature: featureName } : {}),
      },
    } as any);
  };

  const goToPaywall = () => {
    router.push("/paywall" as any);
  };

  const handleRestorePurchases = async () => {
    if (restoreLoading) return;

    try {
      console.log("💳 [PublicLanding] restore purchases started");
      setRestoreLoading(true);
      setPremiumChecking(true);

      const info = await restorePurchases();
      const activeKeys = Object.keys(info?.entitlements?.active ?? {});
      const entitlementPro = isProActive(info);
      const anyActiveEntitlement = activeKeys.length > 0;
      const premiumDetected = entitlementPro || anyActiveEntitlement;

      console.log("💳 [PublicLanding] restore purchases result:", {
        originalAppUserId: info?.originalAppUserId,
        activeKeys,
        entitlementPro,
        anyActiveEntitlement,
        premiumDetected,
      });

      setActiveEntitlementKeys(activeKeys);
      setHasPremiumAccess(premiumDetected);

      if (premiumDetected) {
        Alert.alert(
          "Premium restored",
          "Premium is active. Create an account when you’re ready to use Text Mom and Call Mom.",
          [
            { text: "Not Now", style: "cancel" },
            { text: "Create Account", onPress: () => goToSignUp() },
          ]
        );
      } else {
        Alert.alert(
          "No active subscription found",
          "We couldn’t find an active subscription for this Apple or Google account."
        );
      }
    } catch (error: any) {
      console.log("💳 [PublicLanding] restore purchases failed:", error);

      const message = String(
        error?.message || "We couldn’t restore purchases right now. Please try again."
      );

      Alert.alert("Restore failed", message);
    } finally {
      setRestoreLoading(false);
      setPremiumChecking(false);
    }
  };

  const handlePremiumFeaturePress = (featureName: string) => {
    console.log("💳 [PublicLanding] premium feature pressed:", {
      featureName,
      premiumChecking,
      hasPremiumAccess,
      activeEntitlementKeys,
    });

    if (premiumChecking) {
      Alert.alert(
        "Checking subscription",
        "Give us one second to confirm your subscription status."
      );
      refreshPremiumState(`press:${featureName}`);
      return;
    }

    if (hasPremiumAccess) {
      Alert.alert(
        "Account setup needed",
        "Premium is active. Create an account to use Text Mom and Call Mom so support can connect this subscription to you.",
        [
          { text: "Not Now", style: "cancel" },
          { text: "Create Account", onPress: () => goToSignUp(featureName) },
        ]
      );
      return;
    }

    Alert.alert(
      `${featureName} needs Premium`,
      "Ask Mom is free with limits. Text Mom and Call Mom require Premium, and you can subscribe before creating an account.",
      [
        { text: "Not Now", style: "cancel" },
        { text: "View Premium", onPress: goToPaywall },
        { text: "Sign In", onPress: goToSignIn },
        { text: "Create Account", onPress: () => goToSignUp(featureName) },
      ]
    );
  };

  const handleAskMom = () => {
    router.push("/public-ask-mom" as any);
  };

  const showPremiumLocks = !premiumChecking && !hasPremiumAccess;
  const showAccountSetupLocks = !premiumChecking && hasPremiumAccess;

  console.log("💳 [PublicLanding] visual decision:", {
    premiumChecking,
    hasPremiumAccess,
    activeEntitlementKeys,
    showPremiumLocks,
    showAccountSetupLocks,
  });

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={[styles.screen, { paddingTop: 8, paddingBottom: 10 }]}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />

          <Pressable
            onPress={goToSignIn}
            style={({ pressed }) => [
              styles.topAuthButton,
              pressed && styles.topAuthButtonPressed,
            ]}
          >
            <Text style={styles.topAuthButtonText}>SIGN IN</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.main}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footerTotalHeight + 14 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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
                onPress={handleAskMom}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && styles.bigBtnPressed,
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
                onPress={() => handlePremiumFeaturePress("Email / Text Mom")}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.premiumBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                {showPremiumLocks && <PremiumPerch />}
                {showAccountSetupLocks && <AccountSetupPerch />}

                <View style={styles.iconPill}>
                  <Ionicons name="mail" size={34} color={BRAND.blue} />

                  {showPremiumLocks && (
                    <View style={styles.lockDot}>
                      <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {showAccountSetupLocks && (
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
                    EMAIL / TEXT MOM
                  </Text>

                  <Text style={styles.btnSubText}>
                    {hasPremiumAccess
                      ? "Create account to message support"
                      : premiumChecking
                        ? "Checking Premium status..."
                        : "For non-urgent questions"}
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => handlePremiumFeaturePress("Call Mom")}
                style={({ pressed }) => [
                  styles.bigBtn,
                  styles.premiumBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                {showPremiumLocks && <PremiumPerch />}
                {showAccountSetupLocks && <AccountSetupPerch />}

                <View style={styles.iconPill}>
                  <Ionicons name="call" size={34} color={BRAND.blue} />

                  {showPremiumLocks && (
                    <View style={styles.lockDot}>
                      <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                    </View>
                  )}

                  {showAccountSetupLocks && (
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
                    {hasPremiumAccess
                      ? "Create account to connect phone support"
                      : premiumChecking
                        ? "Checking Premium status..."
                        : "When you need to talk to a real person"}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.subscriptionNotice}>
                {premiumChecking ? (
                  <ActivityIndicator size="small" color={BRAND.blue} />
                ) : (
                  <Ionicons
                    name={hasPremiumAccess ? "checkmark-circle" : "information-circle-outline"}
                    size={17}
                    color={BRAND.blue}
                  />
                )}

                <Text style={styles.subscriptionNoticeText}>
                  {hasPremiumAccess
                    ? "Premium is active. Text Mom and Call Mom need account setup so we can connect support to you."
                    : "Ask Mom is free with limits. You can view Premium before creating an account. Text Mom and Call Mom need Premium and account setup."}
                </Text>
              </View>

              <Pressable
                onPress={goToPaywall}
                style={({ pressed }) => [
                  styles.viewPremiumButton,
                  hasPremiumAccess && styles.viewPremiumButtonActive,
                  pressed && styles.viewPremiumButtonPressed,
                ]}
              >
                <Ionicons
                  name={hasPremiumAccess ? "checkmark-circle" : "diamond"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.viewPremiumText}>
                  {hasPremiumAccess ? "Premium Active" : "View Premium"}
                </Text>
              </Pressable>

              {!hasPremiumAccess && (
                <Pressable
                  onPress={handleRestorePurchases}
                  disabled={restoreLoading}
                  style={({ pressed }) => [
                    styles.restorePurchasesButton,
                    pressed && !restoreLoading && styles.restorePurchasesButtonPressed,
                    restoreLoading && styles.restorePurchasesButtonDisabled,
                  ]}
                >
                  {restoreLoading ? (
                    <ActivityIndicator size="small" color={BRAND.blue} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={BRAND.blue} />
                  )}

                  <Text style={styles.restorePurchasesText}>
                    {restoreLoading ? "Restoring..." : "Restore Purchases"}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => goToSignUp()}
                style={({ pressed }) => [
                  styles.createAccountButton,
                  pressed && styles.createAccountButtonPressed,
                ]}
              >
                <Ionicons name="person-add" size={18} color={BRAND.blue} />
                <Text style={styles.createAccountText}>
                  {hasPremiumAccess ? "Finish Account Setup" : "Create Free Account"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

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
    paddingTop: IS_ANDROID ? 0 : 2,
    paddingBottom: IS_ANDROID ? 4 : 6,
  },

  topAuthButton: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  topAuthButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  topAuthButtonText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 12,
    letterSpacing: 0.8,
  },

  main: { flex: 1 },

  scrollContent: { flexGrow: 1 },

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

  subscriptionNotice: {
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  subscriptionNoticeText: {
    flex: 1,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },

  actionsWrap: {
    flex: 1,
    justifyContent: "flex-start",
  },

  actions: {
    width: "100%",
    gap: IS_ANDROID ? 10 : 12,
  },

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

  bigBtnPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.98,
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

  bigBtnTextNarrow: {
    letterSpacing: IS_ANDROID ? 0.25 : 0.4,
  },

  btnSubText: {
    marginTop: IS_ANDROID ? 4 : 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    letterSpacing: 0.2,
    flexShrink: 1,
  },

  viewPremiumButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.blue,
    backgroundColor: BRAND.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  viewPremiumButtonActive: {
    borderColor: BRAND.blue,
    backgroundColor: BRAND.blue,
  },

  viewPremiumButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },

  viewPremiumText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  restorePurchasesButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  restorePurchasesButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },

  restorePurchasesButtonDisabled: {
    opacity: 0.65,
  },

  restorePurchasesText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 15,
    letterSpacing: 0.2,
  },

  createAccountButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  createAccountButtonPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },

  createAccountText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 15,
    letterSpacing: 0.2,
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
});