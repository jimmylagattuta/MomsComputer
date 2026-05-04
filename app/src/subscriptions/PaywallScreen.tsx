// app/src/subscriptions/PaywallScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Purchases, {
  CustomerInfo,
  PurchasesError,
  PurchasesPackage,
} from "react-native-purchases";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ENTITLEMENT_ID } from "./constants";
import { configureRevenueCat } from "./rcClient";
import { useSubscription } from "./useSubscription";

const IS_ANDROID = Platform.OS === "android";

const TERMS_URL = "https://momscomputer.com/terms/";
const PRIVACY_URL = "https://momscomputer.com/privacy/";
const MOMS_LOGO_URL =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1769703507/ChatGPT_Image_Jan_29_2026_08_00_07_AM_1_3_gtqeo8.jpg";

const BRAND = {
  pageBg: "#F7FAFF",
  card: "#FFFFFF",
  border: "#DDE7F3",
  borderSoft: "#EAF1F8",
  text: "#10203A",
  muted: "#667085",
  mutedDark: "#475467",
  blue: "#4E86FF",
  blueDark: "#2F6CE6",
  blueSoft: "#EDF4FF",
  blueBorder: "#D8E6FF",
  pink: "#F67CB5",
  pinkSoft: "#FFF0F8",
  pinkBorder: "#FFD3E8",
  yellow: "#F6C453",
  yellowSoft: "#FFF8E7",
  green: "#12B76A",
  greenSoft: "#ECFDF3",
  greenBorder: "#ABEFC6",
  purple: "#8B7CFF",
  purpleSoft: "#F1EEFF",
  shadow: "#0F172A",
};

function formatPrice(pkg: PurchasesPackage) {
  // @ts-ignore
  return pkg?.product?.priceString ?? "";
}

function getDurationText(pkg: PurchasesPackage) {
  const product: any = (pkg as any)?.product;
  const subscriptionPeriod: any = product?.subscriptionPeriod;

  if (!subscriptionPeriod) return "";

  const unitFromObject =
    typeof subscriptionPeriod === "object"
      ? String(subscriptionPeriod.unit ?? "").toLowerCase()
      : "";

  const valueFromObject =
    typeof subscriptionPeriod === "object"
      ? Number(subscriptionPeriod.value ?? 0)
      : 0;

  if (unitFromObject && valueFromObject) {
    const cleanUnit =
      valueFromObject === 1
        ? unitFromObject.replace(/s$/, "")
        : unitFromObject.endsWith("s")
          ? unitFromObject
          : `${unitFromObject}s`;

    return `${valueFromObject} ${cleanUnit}`;
  }

  if (typeof subscriptionPeriod === "string") {
    const match = subscriptionPeriod.match(/^P(\d+)([DWMY])$/i);
    if (!match) return "";

    const value = Number(match[1] ?? 0);
    const code = String(match[2] ?? "").toUpperCase();

    const unit =
      code === "D"
        ? "day"
        : code === "W"
          ? "week"
          : code === "M"
            ? "month"
            : code === "Y"
              ? "year"
              : "";

    if (!unit || !value) return "";

    return `${value} ${value === 1 ? unit : `${unit}s`}`;
  }

  return "";
}

function getActiveEntitlement(info: CustomerInfo | null) {
  if (!info) return null;
  return info?.entitlements?.active?.[ENTITLEMENT_ID] ?? null;
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Unable to open link", url);
  });
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    isPro,
    loading: subLoading,
    refresh: refreshSubscription,
    customerInfo,
    identityReady,
  } = useSubscription();

  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [purchaseLoadingId, setPurchaseLoadingId] = useState<string | null>(null);

  const activeEntitlement = useMemo(
    () => getActiveEntitlement(customerInfo),
    [customerInfo]
  );

  const mainPackage = packages?.[0] ?? null;
  const mainPrice = mainPackage ? formatPrice(mainPackage) : "";
  const mainDuration = mainPackage ? getDurationText(mainPackage) : "";

  useEffect(() => {
    if (!identityReady) return;

    if (!subLoading && isPro) {
      try {
        // @ts-ignore
        if (router?.canGoBack?.()) {
          router.back();
        }
      } catch {}
    }
  }, [identityReady, isPro, subLoading, router]);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    setOfferingsError(null);
    setPackages([]);

    try {
      const configured = await configureRevenueCat();

      if (!configured) {
        setOfferingsError("Subscriptions are not ready yet. Please try again soon.");
        return;
      }

      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings?.current;

      if (!currentOffering) {
        setOfferingsError("The subscription plan is not available yet.");
        return;
      }

      const availablePackages = currentOffering.availablePackages ?? [];

      if (!availablePackages.length) {
        setOfferingsError("The subscription plan is not available right now.");
        return;
      }

      setPackages(availablePackages);
    } catch (error: any) {
      const message =
        error?.message ??
        (typeof (error as PurchasesError)?.toString === "function"
          ? (error as PurchasesError).toString()
          : "Unable to load the subscription plan.");

      setOfferingsError(String(message));
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const handleClose = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) {
        router.back();
      } else {
        router.replace("/(app)");
      }
    } catch {}
  };

  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      setPurchaseLoadingId(pkg.identifier);

      const configured = await configureRevenueCat();

      if (!configured) {
        Alert.alert("Not ready", "Subscriptions are not ready yet. Please try again.");
        return;
      }

      await Purchases.purchasePackage(pkg);
      await refreshSubscription();

      Alert.alert(
        "You are subscribed",
        "Premium is active. Your paid features are now unlocked."
      );

      try {
        // @ts-ignore
        if (router?.canGoBack?.()) {
          router.back();
        } else {
          router.replace("/(app)");
        }
      } catch {}
    } catch (error: any) {
      const message = String(error?.message ?? "The subscription did not go through.");

      if (message.toLowerCase().includes("cancel")) return;

      Alert.alert("Subscription error", message);
    } finally {
      setPurchaseLoadingId(null);
    }
  };

  const screenLoading = !identityReady || subLoading;

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="large" color={BRAND.blue} />
          </View>

          <Text style={styles.loadingTitle}>Loading Premium</Text>
          <Text style={styles.loadingSub}>Getting your options ready…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isPro) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <View style={styles.successOrb}>
            <Ionicons name="checkmark-circle" size={52} color={BRAND.green} />
          </View>

          <View style={styles.successLogoWrap}>
            <Image
              source={{ uri: MOMS_LOGO_URL }}
              style={styles.successLogo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.successTitle}>Premium is active</Text>

          <Text style={styles.successBody}>
            Your paid features are ready to use.
          </Text>

          {!!activeEntitlement?.expirationDate && (
            <Text style={styles.successMeta}>
              Renews or expires:{" "}
              {new Date(activeEntitlement.expirationDate).toLocaleDateString()}
            </Text>
          )}

          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.primaryButtonFull,
              pressed && styles.primaryButtonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: IS_ANDROID ? Math.max(insets.top, 12) + 6 : 6,
            paddingBottom: Math.max(insets.bottom, 16) + 28,
          },
        ]}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.sparklePill}>
              <Ionicons name="sparkles" size={14} color={BRAND.purple} />
              <Text style={styles.sparklePillText}>Premium Features</Text>
            </View>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={21} color={BRAND.mutedDark} />
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.decorBubblePink} />
          <View style={styles.decorBubbleBlue} />

          <View style={styles.heroLogoWrap}>
            <Image
              source={{ uri: MOMS_LOGO_URL }}
              style={styles.heroLogo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.heroTitle}>Mom&apos;s Computer</Text>

          <Text style={styles.heroSubTitle}>Ask Mom is free</Text>

          <Text style={styles.heroBody}>
            Upgrade to access extra support features.
          </Text>

          <View style={styles.freePill}>
            <Ionicons name="heart" size={16} color={BRAND.pink} />
            <Text style={styles.freePillText}>You can keep using Ask Mom for free</Text>
          </View>
        </View>

        <View style={styles.comparisonWrap}>
          <View style={[styles.infoCard, styles.freeCard]}>
            <View style={styles.infoHeaderRow}>
              <View style={[styles.iconCircle, styles.iconCirclePink]}>
                <Ionicons name="chatbubble-ellipses" size={20} color={BRAND.pink} />
              </View>
              <Text style={styles.infoCardTitle}>Free</Text>
            </View>

            <Text style={styles.infoCardLead}>Included with the app</Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={BRAND.green} />
                <Text style={styles.featureText}>Ask Mom</Text>
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, styles.premiumCard]}>
            <View style={styles.infoHeaderRow}>
              <View style={[styles.iconCircle, styles.iconCircleBlue]}>
                <Ionicons name="diamond" size={20} color={BRAND.blue} />
              </View>
              <Text style={styles.infoCardTitle}>Premium</Text>
            </View>

            <Text style={styles.infoCardLead}>Unlock the other features</Text>

            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={BRAND.green} />
                <Text style={styles.featureText}>Text Mom</Text>
              </View>

              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={BRAND.green} />
                <Text style={styles.featureText}>Call Mom</Text>
              </View>

              <View style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={20} color={BRAND.green} />
                <Text style={styles.featureText}>Extra support features</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceTopRow}>
            <View>
              <Text style={styles.priceLabel}>Premium Subscription</Text>

              {offeringsLoading ? (
                <Text style={styles.priceLoadingText}>Loading price…</Text>
              ) : (
                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>{mainPrice || "$9.99"}</Text>
                  <Text style={styles.priceSubtext}>
                    {mainDuration ? ` / ${mainDuration}` : " / month"}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.priceBadge}>
              <Ionicons name="star" size={14} color={BRAND.yellow} />
              <Text style={styles.priceBadgeText}>Simple</Text>
            </View>
          </View>

          {!!offeringsError ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorTitle}>Subscription unavailable</Text>
              <Text style={styles.errorText}>{offeringsError}</Text>

              <Pressable
                onPress={loadOfferings}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.planHelpText}>
                Payment is handled securely by Apple or Google. You can cancel anytime
                in your account settings.
              </Text>

              <Pressable
                onPress={() => mainPackage && handlePurchase(mainPackage)}
                disabled={!mainPackage || !!purchaseLoadingId || offeringsLoading}
                style={({ pressed }) => [
                  styles.primaryButtonFull,
                  pressed &&
                    !purchaseLoadingId &&
                    !!mainPackage &&
                    !offeringsLoading &&
                    styles.primaryButtonPressed,
                  (!mainPackage || !!purchaseLoadingId || offeringsLoading) &&
                    styles.disabledButton,
                ]}
              >
                {purchaseLoadingId === mainPackage?.identifier ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Subscribe{mainPrice ? ` for ${mainPrice}` : ""}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>

        <Pressable
          onPress={handleClose}
          style={({ pressed }) => [
            styles.freeContinueButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.freeContinueButtonText}>Continue with free Ask Mom</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={20} color={BRAND.blue} />
          <Text style={styles.noteText}>
            Ask Mom stays free. Premium is only for the extra support features.
          </Text>
        </View>

        <View style={styles.legalLinksRow}>
          <Pressable
            onPress={() => openUrl(PRIVACY_URL)}
            style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </Pressable>

          <View style={styles.legalDot} />

          <Pressable
            onPress={() => openUrl(TERMS_URL)}
            style={({ pressed }) => [styles.legalLink, pressed && styles.pressed]}
          >
            <Text style={styles.legalLinkText}>Terms</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BRAND.pageBg,
  },

  container: {
    paddingHorizontal: 18,
    backgroundColor: BRAND.pageBg,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: BRAND.pageBg,
  },

  loadingOrb: {
    width: 82,
    height: 82,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    shadowColor: BRAND.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  loadingTitle: {
    marginTop: 18,
    color: BRAND.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },

  loadingSub: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },

  successOrb: {
    width: 88,
    height: 88,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.greenSoft,
    borderWidth: 1,
    borderColor: BRAND.greenBorder,
    marginBottom: 14,
  },

  successLogoWrap: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },

  successLogo: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },

  successTitle: {
    color: BRAND.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },

  successBody: {
    marginTop: 8,
    color: BRAND.muted,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },

  successMeta: {
    marginTop: 10,
    color: BRAND.mutedDark,
    fontSize: 14,
    textAlign: "center",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  topBarLeft: {
    flex: 1,
  },

  sparklePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: BRAND.purpleSoft,
    borderWidth: 1,
    borderColor: "#DDD8FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  sparklePillText: {
    color: BRAND.purple,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },

  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.borderSoft,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  heroCard: {
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderRadius: 30,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.borderSoft,
    shadowColor: BRAND.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },

  decorBubblePink: {
    position: "absolute",
    top: 70,
    right: -48,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: BRAND.pinkSoft,
    zIndex: 1,
  },

  decorBubbleBlue: {
    position: "absolute",
    bottom: -34,
    left: -18,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    zIndex: 1,
  },

  heroLogoWrap: {
    alignSelf: "stretch",
    marginLeft: -20,
    marginRight: -20,
    marginTop: 0,
    marginBottom: 18,
    paddingHorizontal: 0,
    height: 172,
    overflow: "hidden",
    zIndex: 2,
    backgroundColor: "#FFFFFF",
  },

  heroLogo: {
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },

  heroTitle: {
    color: BRAND.text,
    fontSize: IS_ANDROID ? 28 : 30,
    lineHeight: IS_ANDROID ? 34 : 36,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
    zIndex: 2,
  },

  heroSubTitle: {
    marginTop: 6,
    color: BRAND.blueDark,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    zIndex: 2,
  },

  heroBody: {
    marginTop: 10,
    color: BRAND.muted,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
    zIndex: 2,
  },

  freePill: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: BRAND.pinkSoft,
    borderWidth: 1,
    borderColor: BRAND.pinkBorder,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 2,
  },

  freePillText: {
    color: "#B53A73",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },

  comparisonWrap: {
    marginTop: 16,
    gap: 14,
  },

  infoCard: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: BRAND.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },

  freeCard: {
    backgroundColor: "#FFFFFF",
    borderColor: BRAND.pinkBorder,
  },

  premiumCard: {
    backgroundColor: "#FFFFFF",
    borderColor: BRAND.blueBorder,
  },

  infoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  iconCirclePink: {
    backgroundColor: BRAND.pinkSoft,
    borderWidth: 1,
    borderColor: BRAND.pinkBorder,
  },

  iconCircleBlue: {
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  infoCardTitle: {
    color: BRAND.text,
    fontSize: 20,
    fontWeight: "900",
  },

  infoCardLead: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 12,
  },

  featureList: {
    gap: 10,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  featureText: {
    flex: 1,
    color: BRAND.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },

  priceCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 26,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.borderSoft,
    shadowColor: BRAND.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  priceTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  priceLabel: {
    color: BRAND.mutedDark,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  priceLoadingText: {
    marginTop: 10,
    color: BRAND.muted,
    fontSize: 16,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 8,
  },

  priceText: {
    color: BRAND.text,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -0.8,
  },

  priceSubtext: {
    color: BRAND.muted,
    fontSize: 17,
    fontWeight: "800",
    paddingBottom: 7,
    marginLeft: 6,
  },

  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: BRAND.yellowSoft,
    borderWidth: 1,
    borderColor: "#F7E2A6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },

  priceBadgeText: {
    color: "#B48312",
    fontSize: 12,
    fontWeight: "900",
  },

  planHelpText: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 2,
  },

  primaryButtonFull: {
    width: "100%",
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    shadowColor: BRAND.blue,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    marginTop: 18,
  },

  primaryButtonPressed: {
    backgroundColor: BRAND.blueDark,
    transform: [{ scale: 0.99 }],
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.2,
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.65,
  },

  secondaryButton: {
    alignSelf: "center",
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 14,
  },

  secondaryButtonText: {
    color: BRAND.blue,
    fontSize: 15,
    fontWeight: "900",
  },

  errorWrap: {
    paddingTop: 6,
  },

  errorTitle: {
    color: BRAND.text,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },

  errorText: {
    color: BRAND.muted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },

  freeContinueButton: {
    marginTop: 14,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  freeContinueButtonText: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  noteCard: {
    marginTop: 14,
    padding: 15,
    borderRadius: 18,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  noteText: {
    flex: 1,
    color: BRAND.blueDark,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },

  legalLinksRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
  },

  legalLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },

  legalLinkText: {
    color: BRAND.blue,
    fontSize: 14,
    fontWeight: "900",
  },

  legalDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: BRAND.muted,
    opacity: 0.45,
  },
});