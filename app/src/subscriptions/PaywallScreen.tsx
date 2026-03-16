// app/src/subscriptions/PaywallScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  configureRevenueCat,
  getCustomerInfo,
  rcIdentifyUser,
  restorePurchases,
} from "./rcClient";
import { getRevenueCatApiKey } from "./rcKeys";
import { useSubscription } from "./useSubscription";

/**
 * ✅ Public-facing Paywall
 * - Plans shown prominently
 * - Required subscription info shown in-app
 * - Developer tools hidden behind a collapsible dropdown
 * - Auto-dismiss only after RevenueCat identity is settled
 * - TEMP DEBUG FLAG to keep the paywall from immediately navigating away
 */

const DISABLE_AUTO_DISMISS_FOR_DEBUG = true;
const IS_ANDROID = Platform.OS === "android";

const BRAND = {
  pageBg: "#FFFFFF",
  card: "#F3F4F6",
  card2: "#EEF2F7",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  dark: "#111827",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  dangerSoft: "#FEF2F2",
  successSoft: "#ECFDF3",
  successBorder: "#ABEFC6",
  warningSoft: "#FFFAEB",
  warningBorder: "#FEDF89",
};

const TERMS_URL = "https://momscomputer.com/terms/";
const PRIVACY_URL = "https://momscomputer.com/privacy/";

function formatPrice(pkg: PurchasesPackage) {
  // @ts-ignore
  return pkg?.product?.priceString ?? "";
}

function getDurationText(pkg: PurchasesPackage) {
  const p: any = (pkg as any)?.product;
  const sp: any = p?.subscriptionPeriod;

  if (!sp) return "";

  const unitObj = typeof sp === "object" ? String(sp.unit ?? "").toLowerCase() : "";
  const valueObj = typeof sp === "object" ? Number(sp.value ?? 0) : 0;

  if (unitObj && valueObj) {
    const label =
      valueObj === 1
        ? unitObj.replace(/s$/, "")
        : unitObj.endsWith("s")
          ? unitObj
          : `${unitObj}s`;
    return `${valueObj} ${label}`;
  }

  if (typeof sp === "string") {
    const m = sp.match(/^P(\d+)([DWMY])$/i);
    if (!m) return "";
    const value = Number(m[1] ?? 0);
    const code = String(m[2] ?? "").toUpperCase();

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

function getPkgTitle(pkg: PurchasesPackage) {
  // @ts-ignore
  return pkg?.product?.title ?? "Subscription";
}

function getPkgDescription(pkg: PurchasesPackage) {
  // @ts-ignore
  return pkg?.product?.description ?? "";
}

function safeStringify(obj: any, maxLen = 16000) {
  try {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}\n…(truncated)…`;
  } catch (e: any) {
    return `<<json stringify failed: ${String(e?.message ?? e)}>>`;
  }
}

function maskKey(key: string | null | undefined) {
  const k = String(key || "");
  if (!k) return "(missing)";
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}…${k.slice(-4)} (len=${k.length})`;
}

async function getAppUserIdCompat(): Promise<string | null> {
  try {
    const maybe = (Purchases as any).getAppUserID?.();
    const id = typeof maybe?.then === "function" ? await maybe : maybe;
    if (!id) return null;
    return String(id);
  } catch {
    return null;
  }
}

async function getIsAnonymousCompat(): Promise<boolean | null> {
  try {
    const fn = (Purchases as any).isAnonymous;
    if (typeof fn !== "function") return null;
    const maybe = fn();
    const val = typeof maybe?.then === "function" ? await maybe : maybe;
    return typeof val === "boolean" ? val : null;
  } catch {
    return null;
  }
}

function openUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Unable to open link", url);
  });
}

function formatIsoDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toLocaleString()} (${iso})`;
}

function getTimeUntil(iso?: string | null) {
  if (!iso) return "—";

  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diff = then - Date.now();
  if (diff <= 0) return "expired";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function extractSubscriptionStatus(info: CustomerInfo | null) {
  if (!info) {
    return {
      status: "no_customer_info",
      title: "No customer info",
      isActive: false,
      willRenew: null,
      expirationDate: null,
      expirationIn: "—",
      latestPurchaseDate: null,
      originalPurchaseDate: null,
      productIdentifier: null,
      store: null,
      ownershipType: null,
      activeSubscriptions: [],
      allPurchasedProductIds: [],
    };
  }

  const ent: any = info?.entitlements?.all?.[ENTITLEMENT_ID];
  const activeSubscriptions = Array.isArray((info as any)?.activeSubscriptions)
    ? (info as any).activeSubscriptions
    : [];
  const allPurchasedProductIds = Array.isArray((info as any)?.allPurchasedProductIdentifiers)
    ? (info as any).allPurchasedProductIdentifiers
    : [];

  if (!ent) {
    return {
      status: "no_entitlement_found",
      title: "Entitlement missing",
      isActive: false,
      willRenew: null,
      expirationDate: null,
      expirationIn: "—",
      latestPurchaseDate: null,
      originalPurchaseDate: null,
      productIdentifier: null,
      store: null,
      ownershipType: null,
      activeSubscriptions,
      allPurchasedProductIds,
    };
  }

  const isActive = !!ent.isActive;
  const expirationDate = ent.expirationDate ?? null;

  return {
    status: isActive ? "active" : "inactive",
    title: isActive ? "Active" : "Inactive",
    isActive,
    willRenew: typeof ent.willRenew === "boolean" ? ent.willRenew : null,
    expirationDate,
    expirationIn: getTimeUntil(expirationDate),
    latestPurchaseDate: ent.latestPurchaseDate ?? null,
    originalPurchaseDate: ent.originalPurchaseDate ?? null,
    productIdentifier: ent.productIdentifier ?? null,
    store: ent.store ?? null,
    ownershipType: ent.ownershipType ?? null,
    activeSubscriptions,
    allPurchasedProductIds,
  };
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    isPro,
    loading: subLoading,
    refresh: refreshHook,
    customerInfo: hookInfo,
    identityReady,
  } = useSubscription();

  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);

  const [devOpen, setDevOpen] = useState(false);

  const [dbgLoading, setDbgLoading] = useState(false);
  const [dbgLastUpdated, setDbgLastUpdated] = useState<string | null>(null);
  const [dbgError, setDbgError] = useState<string | null>(null);
  const [dbg, setDbg] = useState<any>(null);

  const lastIdentifyRef = useRef<string | null>(null);

  useEffect(() => {
    if (DISABLE_AUTO_DISMISS_FOR_DEBUG) return;
    if (!identityReady) return;

    if (!subLoading && isPro) {
      try {
        // @ts-ignore
        if (router?.canGoBack?.()) router.back();
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
        setOfferingsError("Purchases aren’t configured yet (missing API key or user id).");
        return;
      }

      const offerings = await Purchases.getOfferings();
      const current = offerings?.current;

      if (!current) {
        setOfferingsError(
          "Plans aren’t available yet. (Offerings.current is null — products may not be fully available in sandbox for this build.)"
        );
        return;
      }

      const pkgs = current.availablePackages ?? [];
      if (!pkgs.length) {
        setOfferingsError("No subscription packages found in the current offering.");
        return;
      }

      setPackages(pkgs);
    } catch (e: any) {
      const msg =
        e?.message ??
        (typeof (e as PurchasesError)?.toString === "function"
          ? (e as PurchasesError).toString()
          : "Failed to load plans.");
      setOfferingsError(String(msg));
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const header = useMemo(() => {
    if (!identityReady || subLoading) return "Loading…";
    if (isPro) return "✅ Premium is active";
    return "Upgrade to Premium";
  }, [identityReady, subLoading, isPro]);

  const buildDebugSnapshot = useCallback(async () => {
    setDbgLoading(true);
    setDbgError(null);

    try {
      const nowIso = new Date().toISOString();

      const apiKeyMasked = maskKey(getRevenueCatApiKey());
      const appOwnership = (Constants as any)?.appOwnership ?? null;
      const releaseChannel =
        (Constants as any)?.expoConfig?.extra?.eas?.releaseChannel ??
        (Constants as any)?.manifest2?.extra?.eas?.releaseChannel ??
        null;

      const token = await SecureStore.getItemAsync("auth_token");
      const authUserRaw = await SecureStore.getItemAsync("auth_user");
      let authUser: any = null;
      try {
        authUser = authUserRaw ? JSON.parse(authUserRaw) : null;
      } catch {
        authUser = { parseError: true, raw: authUserRaw };
      }

      const configured = await configureRevenueCat();
      const appUserId = configured ? await getAppUserIdCompat() : null;
      const isAnon = configured ? await getIsAnonymousCompat() : null;

      let identifyAttempt: any = null;
      const dbUserId = authUser?.id != null ? String(authUser.id) : null;

      if (configured && dbUserId) {
        const shouldAttempt = lastIdentifyRef.current !== dbUserId;
        if (shouldAttempt) lastIdentifyRef.current = dbUserId;

        try {
          const infoAfter = await rcIdentifyUser(dbUserId);
          identifyAttempt = {
            attempted: true,
            attemptedNow: shouldAttempt,
            dbUserId,
            resultOriginalAppUserId: infoAfter?.originalAppUserId ?? null,
            activeEntitlements: Object.keys(infoAfter?.entitlements?.active ?? {}),
          };
        } catch (e: any) {
          identifyAttempt = {
            attempted: true,
            attemptedNow: shouldAttempt,
            dbUserId,
            error: String(e?.message ?? e),
          };
        }
      } else {
        identifyAttempt = { attempted: false, dbUserId, configured };
      }

      let directCustomerInfo: CustomerInfo | null = null;
      let directCustomerInfoErr: any = null;
      if (configured) {
        try {
          directCustomerInfo = await getCustomerInfo();
        } catch (e: any) {
          directCustomerInfoErr = String(e?.message ?? e);
        }
      }

      let offeringsSnap: any = null;
      let offeringsSnapErr: any = null;
      if (configured) {
        try {
          const offerings = await Purchases.getOfferings();
          offeringsSnap = {
            currentIdentifier: offerings?.current?.identifier ?? null,
            offeringKeys: Object.keys(offerings?.all ?? {}),
            currentAvailablePackages:
              (offerings?.current?.availablePackages ?? []).map((p: any) => ({
                identifier: p?.identifier,
                packageType: p?.packageType,
                productIdentifier: p?.product?.identifier ?? null,
                productTitle: p?.product?.title ?? null,
                priceString: p?.product?.priceString ?? null,
              })) ?? [],
          };
        } catch (e: any) {
          offeringsSnapErr = String(e?.message ?? e);
        }
      }

      const hookOriginalId = hookInfo?.originalAppUserId ?? null;
      const directOriginalId = directCustomerInfo?.originalAppUserId ?? null;

      const hookEnts = Object.keys(hookInfo?.entitlements?.active ?? {});
      const directEnts = Object.keys(directCustomerInfo?.entitlements?.active ?? {});

      const directIsPro = !!directCustomerInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      const subStatus = extractSubscriptionStatus(directCustomerInfo);

      const autoDismissReason = (() => {
        if (DISABLE_AUTO_DISMISS_FOR_DEBUG) {
          return "Auto-dismiss disabled for debug";
        }
        if (!identityReady) return "identityReady=false (paywall should stay open)";
        if (subLoading) return "Hook still loading (subLoading=true)";
        if (isPro) return "isPro=true (would dismiss)";
        return `isPro=false (ENTITLEMENT_ID="${ENTITLEMENT_ID}" not active)`;
      })();

      const snapshot = {
        timestamp: nowIso,
        app: {
          platform: Platform.OS,
          appOwnership,
          releaseChannel,
          expoVersion: (Constants as any)?.expoVersion ?? null,
          nativeAppVersion: (Constants as any)?.nativeAppVersion ?? null,
          nativeBuildVersion: (Constants as any)?.nativeBuildVersion ?? null,
          extra: {
            hasRevenuecatExtra: !!(Constants as any)?.expoConfig?.extra?.revenuecat,
          },
        },
        auth: {
          hasToken: !!token,
          tokenLen: token ? String(token).length : 0,
          userFromSecureStore: authUser,
        },
        revenuecat: {
          configured,
          apiKeyMasked,
          appUserIdBeforeOrNow: appUserId,
          isAnonymous: isAnon,
          identifyAttempt,
          hook: {
            loading: subLoading,
            identityReady,
            isPro,
            originalAppUserId: hookOriginalId,
            activeEntitlements: hookEnts,
          },
          direct: {
            originalAppUserId: directOriginalId,
            activeEntitlements: directEnts,
            entitlementId: ENTITLEMENT_ID,
            directIsPro,
            error: directCustomerInfoErr,
          },
          subscription: subStatus,
          compare: {
            hookOriginalId,
            directOriginalId,
            sameOriginalId:
              hookOriginalId && directOriginalId ? hookOriginalId === directOriginalId : null,
            hookVsDirectEntitlementKeysSame: safeStringify(hookEnts) === safeStringify(directEnts),
          },
          offerings: {
            snapshot: offeringsSnap,
            error: offeringsSnapErr,
          },
          autoDismiss: {
            disabledForDebug: DISABLE_AUTO_DISMISS_FOR_DEBUG,
            reason: autoDismissReason,
          },
        },
      };

      setDbg(snapshot);
      setDbgLastUpdated(nowIso);
    } catch (e: any) {
      setDbgError(String(e?.message ?? e));
    } finally {
      setDbgLoading(false);
    }
  }, [hookInfo, identityReady, isPro, subLoading]);

  useEffect(() => {
    buildDebugSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    try {
      // @ts-ignore
      if (router?.canGoBack?.()) router.back();
      else router.replace("/(app)");
    } catch {}
  };

  const screenLoading = !identityReady || subLoading;
  const debugSub = dbg?.revenuecat?.subscription ?? null;
  const debugOfferings = dbg?.revenuecat?.offerings ?? null;
  const debugDirect = dbg?.revenuecat?.direct ?? null;

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.loadingTitle}>{header}</Text>
          <Text style={styles.loadingSub}>Preparing secure purchase options…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstPkg = packages?.[0];
  const firstPrice = firstPkg ? formatPrice(firstPkg) : "";
  const firstDuration = firstPkg ? getDurationText(firstPkg) : "";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, IS_ANDROID ? 14 : 18) + 10,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{header}</Text>
            {!isPro && (
              <Text style={styles.subText}>
                Premium unlocks the full “Ask Mom” experience and priority help.
              </Text>
            )}

            <Text style={styles.debugLine}>
              debug: identityReady={String(identityReady)} | subLoading={String(subLoading)} | isPro={String(isPro)} | autoDismissDisabled={String(DISABLE_AUTO_DISMISS_FOR_DEBUG)}
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </View>

        {!isPro && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Subscription details</Text>

            <View style={{ height: 8 }} />

            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Plan: </Text>
              Premium Monthly
            </Text>

            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Length: </Text>
              {firstDuration || "Monthly"}
            </Text>

            <Text style={styles.infoLine}>
              <Text style={styles.infoLabel}>Price: </Text>
              {firstPrice
                ? `${firstPrice}${firstDuration ? ` / ${firstDuration}` : ""}`
                : "Shown on the plan card below"}
            </Text>

            <View style={{ height: 10 }} />

            <Text style={styles.infoFine}>
              Payment is charged to your account at confirmation. Subscription auto-renews unless
              canceled at least 24 hours before the end of the current period. You can manage or
              cancel in your account settings. Cancel anytime.
            </Text>

            <View style={{ height: 10 }} />

            <View style={styles.linksRow}>
              <Pressable
                onPress={() => openUrl(PRIVACY_URL)}
                style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
              >
                <Text style={styles.linkChipText}>Privacy Policy</Text>
              </Pressable>

              <Pressable
                onPress={() => openUrl(TERMS_URL)}
                style={({ pressed }) => [styles.linkChip, pressed && styles.pressed]}
              >
                <Text style={styles.linkChipText}>Terms of Use (EULA)</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 14 }} />
        <Text style={styles.sectionTitle}>Plans</Text>
        <Text style={styles.sectionSub}>Choose a plan below to start your subscription.</Text>

        <View style={{ height: 12 }} />

        {offeringsLoading ? (
          <View style={styles.centerInline}>
            <ActivityIndicator />
            <Text style={styles.inlineText}>Loading plans…</Text>
          </View>
        ) : offeringsError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Plans unavailable</Text>
            <Text style={styles.errorMsg}>{offeringsError}</Text>

            <View style={{ height: 12 }} />

            <Pressable
              onPress={loadOfferings}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
            >
              <Text style={styles.primaryBtnText}>Try again</Text>
            </Pressable>

            <View style={{ height: 8 }} />

            <Pressable
              onPress={async () => {
                setDevOpen(true);
                await buildDebugSnapshot();
              }}
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryBtnText}>Open developer tools</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {packages.map((pkg) => {
              const title = getPkgTitle(pkg);
              const desc = getPkgDescription(pkg);
              const price = formatPrice(pkg);
              const duration = getDurationText(pkg);

              return (
                <View key={pkg.identifier} style={styles.planCard}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View style={styles.planIcon}>
                      <Ionicons name="sparkles" size={16} color={BRAND.blue} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{title}</Text>
                      {!!desc && <Text style={styles.planDesc}>{desc}</Text>}
                      <Text style={styles.planPrice}>
                        {price}
                        {!!duration ? (
                          <Text style={styles.planPriceMuted}> / {duration}</Text>
                        ) : null}
                      </Text>
                    </View>
                  </View>

                  <View style={{ height: 12 }} />

                  <Pressable
                    onPress={async () => {
                      try {
                        const configured = await configureRevenueCat();
                        if (!configured) {
                          Alert.alert("Not ready", "Purchases aren’t configured yet.");
                          return;
                        }

                        await Purchases.purchasePackage(pkg);
                        await refreshHook();
                        await buildDebugSnapshot();

                        Alert.alert(
                          "Purchase completed",
                          "If Premium didn’t activate, open Developer tools and check entitlements."
                        );
                      } catch (e: any) {
                        const msg = String(e?.message ?? "Purchase failed.");
                        if (msg.toLowerCase().includes("cancel")) return;
                        Alert.alert("Purchase error", msg);
                        try {
                          await buildDebugSnapshot();
                        } catch {}
                      }
                    }}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
                  >
                    <Text style={styles.primaryBtnText}>Subscribe</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 14 }} />
        <Pressable
          onPress={async () => {
            try {
              await restorePurchases();
              await refreshHook();
              await buildDebugSnapshot();
              Alert.alert("Restored", "Purchases restored (if any).");
            } catch (e: any) {
              Alert.alert("Restore failed", String(e?.message ?? "Restore failed."));
              try {
                await buildDebugSnapshot();
              } catch {}
            }
          }}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryBtnText}>Restore purchases</Text>
        </Pressable>

        <View style={{ height: 18 }} />
        <Pressable
          onPress={async () => {
            const next = !devOpen;
            setDevOpen(next);
            if (next) {
              await buildDebugSnapshot();
            }
          }}
          style={({ pressed }) => [styles.devToggle, pressed && styles.pressed]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={styles.devDot} />
            <Text style={styles.devToggleText}>Developer tools</Text>
          </View>
          <Ionicons
            name={devOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color={BRAND.muted}
          />
        </Pressable>

        {devOpen && (
          <View style={styles.devPanel}>
            <Text style={styles.devTitle}>Developer tools</Text>
            <Text style={styles.devSub}>
              Debug snapshot, offerings reload, force-identify, and live subscription status all
              live here.
            </Text>

            <View style={{ height: 12 }} />

            <View style={styles.devActionsRow}>
              <Pressable
                onPress={async () => {
                  try {
                    await refreshHook();
                    await buildDebugSnapshot();
                    Alert.alert("Refreshed", "Subscription + debug info refreshed.");
                  } catch {}
                }}
                style={({ pressed }) => [styles.devBtnDark, pressed && styles.devBtnPressed]}
              >
                <Text style={styles.devBtnDarkText}>
                  {dbgLoading ? "Refreshing…" : "Refresh Debug"}
                </Text>
              </Pressable>

              <Pressable
                onPress={async () => {
                  await loadOfferings();
                  await buildDebugSnapshot();
                }}
                style={({ pressed }) => [styles.devBtnLight, pressed && styles.devBtnPressed]}
              >
                <Text style={styles.devBtnLightText}>Reload Offerings</Text>
              </Pressable>
            </View>

            <View style={{ height: 10 }} />

            <Pressable
              onPress={async () => {
                try {
                  const authUserRaw = await SecureStore.getItemAsync("auth_user");
                  const u = authUserRaw ? JSON.parse(authUserRaw) : null;
                  const id = u?.id != null ? String(u.id) : null;

                  if (!id) {
                    Alert.alert("No DB user id", "auth_user.id was missing from SecureStore.");
                    return;
                  }

                  await rcIdentifyUser(id);
                  await refreshHook();
                  await buildDebugSnapshot();

                  Alert.alert("Forced identify", `Attempted RevenueCat logIn("${id}").`);
                } catch (e: any) {
                  Alert.alert("Force identify failed", String(e?.message ?? e));
                  try {
                    await buildDebugSnapshot();
                  } catch {}
                }
              }}
              style={({ pressed }) => [styles.devBtnLight, pressed && styles.devBtnPressed]}
            >
              <Text style={styles.devBtnLightText}>Force Identify (DB user id)</Text>
            </Pressable>

            {dbgError ? (
              <View style={styles.devError}>
                <Text style={styles.devErrorTitle}>Debug error</Text>
                <Text style={styles.devErrorMsg}>{dbgError}</Text>
              </View>
            ) : null}

            <View style={{ height: 14 }} />

            <View
              style={[
                styles.devSummaryCard,
                debugSub?.isActive
                  ? styles.devSummarySuccess
                  : debugSub?.status === "inactive"
                    ? styles.devSummaryWarning
                    : null,
              ]}
            >
              <Text style={styles.devSectionTitle}>Subscription state</Text>

              <View style={{ height: 10 }} />

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Status</Text>
                <Text style={styles.devValueStrong}>{debugSub?.title ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Entitlement</Text>
                <Text style={styles.devValue}>{ENTITLEMENT_ID}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Will renew</Text>
                <Text style={styles.devValue}>
                  {typeof debugSub?.willRenew === "boolean"
                    ? debugSub.willRenew
                      ? "YES"
                      : "NO"
                    : "—"}
                </Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Product</Text>
                <Text style={styles.devValue}>{debugSub?.productIdentifier ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Store</Text>
                <Text style={styles.devValue}>{debugSub?.store ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Ownership</Text>
                <Text style={styles.devValue}>{debugSub?.ownershipType ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Expires</Text>
                <Text style={styles.devValue}>{formatIsoDate(debugSub?.expirationDate)}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Time left</Text>
                <Text style={styles.devValueStrong}>{debugSub?.expirationIn ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Latest purchase</Text>
                <Text style={styles.devValue}>{formatIsoDate(debugSub?.latestPurchaseDate)}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Original purchase</Text>
                <Text style={styles.devValue}>{formatIsoDate(debugSub?.originalPurchaseDate)}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>RC says Pro</Text>
                <Text style={styles.devValue}>{debugDirect?.directIsPro ? "YES" : "NO"}</Text>
              </View>
            </View>

            <View style={{ height: 12 }} />

            <View style={styles.devSummaryCard}>
              <Text style={styles.devSectionTitle}>Entitlements & products</Text>

              <View style={{ height: 10 }} />

              <Text style={styles.devBlockLabel}>Active entitlements</Text>
              <Text selectable style={styles.monoSmall}>
                {safeStringify(debugDirect?.activeEntitlements ?? [])}
              </Text>

              <View style={{ height: 10 }} />

              <Text style={styles.devBlockLabel}>Active subscriptions</Text>
              <Text selectable style={styles.monoSmall}>
                {safeStringify(debugSub?.activeSubscriptions ?? [])}
              </Text>

              <View style={{ height: 10 }} />

              <Text style={styles.devBlockLabel}>All purchased product IDs</Text>
              <Text selectable style={styles.monoSmall}>
                {safeStringify(debugSub?.allPurchasedProductIds ?? [])}
              </Text>
            </View>

            <View style={{ height: 12 }} />

            <View style={styles.devSummaryCard}>
              <Text style={styles.devSectionTitle}>Offerings</Text>

              <View style={{ height: 10 }} />

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Current offering</Text>
                <Text style={styles.devValue}>{debugOfferings?.snapshot?.currentIdentifier ?? "—"}</Text>
              </View>

              <View style={styles.devRow}>
                <Text style={styles.devKey}>Offering keys</Text>
                <Text style={styles.devValue}>
                  {Array.isArray(debugOfferings?.snapshot?.offeringKeys)
                    ? debugOfferings.snapshot.offeringKeys.join(", ") || "—"
                    : "—"}
                </Text>
              </View>

              <View style={{ height: 8 }} />

              <Text style={styles.devBlockLabel}>Current available packages</Text>
              <Text selectable style={styles.monoSmall}>
                {safeStringify(debugOfferings?.snapshot?.currentAvailablePackages ?? [])}
              </Text>

              {!!debugOfferings?.error && (
                <>
                  <View style={{ height: 10 }} />
                  <Text style={styles.devBlockLabel}>Offerings error</Text>
                  <Text selectable style={styles.monoSmall}>
                    {String(debugOfferings.error)}
                  </Text>
                </>
              )}
            </View>

            <View style={{ height: 12 }} />

            <View style={styles.devSnapshotCard}>
              <Text style={styles.devSnapshotTitle}>🔎 Raw Debug Snapshot</Text>
              <Text style={styles.devSnapshotSub}>Last updated: {dbgLastUpdated ?? "—"}</Text>
              <View style={{ height: 10 }} />
              <Text selectable style={styles.mono}>
                {dbg ? safeStringify(dbg) : "(no debug snapshot yet)"}
              </Text>
            </View>
          </View>
        )}
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
    paddingHorizontal: 16,
    backgroundColor: BRAND.pageBg,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: BRAND.pageBg,
  },

  loadingTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "800",
    color: BRAND.text,
  },

  loadingSub: {
    marginTop: 8,
    color: BRAND.muted,
    textAlign: "center",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  h1: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND.text,
  },

  subText: {
    marginTop: 8,
    color: BRAND.muted,
    lineHeight: 18,
  },

  debugLine: {
    marginTop: 8,
    color: "#B42318",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },

  closeBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  closeBtnText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  infoCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  infoTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND.text,
  },

  infoLine: {
    color: BRAND.text,
    lineHeight: 18,
  },

  infoLabel: {
    fontWeight: "900",
    color: BRAND.text,
  },

  infoFine: {
    color: BRAND.muted,
    lineHeight: 18,
  },

  linksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  linkChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  linkChipText: {
    fontWeight: "900",
    color: BRAND.blue,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND.text,
  },

  sectionSub: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 18,
  },

  centerInline: {
    paddingVertical: 18,
    alignItems: "center",
  },

  inlineText: {
    marginTop: 10,
    color: BRAND.muted,
  },

  errorCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  errorTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: BRAND.text,
  },

  errorMsg: {
    marginTop: 8,
    color: BRAND.muted,
    lineHeight: 18,
  },

  planCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  planIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignItems: "center",
    justifyContent: "center",
  },

  planTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND.text,
  },

  planDesc: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 18,
  },

  planPrice: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "900",
    color: BRAND.text,
  },

  planPriceMuted: {
    fontWeight: "900",
    color: BRAND.muted,
  },

  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: BRAND.dark,
    alignSelf: "flex-start",
  },

  primaryBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-start",
  },

  secondaryBtnText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  devToggle: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  devDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
  },

  devToggleText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  devPanel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: BRAND.card2,
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  devTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND.text,
  },

  devSub: {
    marginTop: 6,
    color: BRAND.muted,
    lineHeight: 18,
  },

  devActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  devBtnDark: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: BRAND.dark,
    alignSelf: "flex-start",
  },

  devBtnDarkText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  devBtnLight: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignSelf: "flex-start",
  },

  devBtnLightText: {
    fontWeight: "900",
    color: BRAND.text,
  },

  devBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  devError: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: BRAND.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
  },

  devErrorTitle: {
    fontWeight: "900",
    color: BRAND.text,
  },

  devErrorMsg: {
    marginTop: 6,
    color: BRAND.text,
    opacity: 0.9,
  },

  devSummaryCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  devSummarySuccess: {
    backgroundColor: BRAND.successSoft,
    borderColor: BRAND.successBorder,
  },

  devSummaryWarning: {
    backgroundColor: BRAND.warningSoft,
    borderColor: BRAND.warningBorder,
  },

  devSectionTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: BRAND.text,
  },

  devRow: {
    marginTop: 6,
  },

  devKey: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: "700",
    marginBottom: 2,
  },

  devValue: {
    fontSize: 14,
    color: BRAND.text,
  },

  devValueStrong: {
    fontSize: 14,
    color: BRAND.text,
    fontWeight: "900",
  },

  devBlockLabel: {
    fontSize: 12,
    color: BRAND.muted,
    fontWeight: "800",
    marginBottom: 4,
  },

  devSnapshotCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  devSnapshotTitle: {
    fontWeight: "900",
    fontSize: 15,
    color: BRAND.text,
  },

  devSnapshotSub: {
    marginTop: 6,
    color: BRAND.muted,
  },

  mono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
    lineHeight: 16,
    color: BRAND.text,
  },

  monoSmall: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 15,
    color: BRAND.text,
  },
});