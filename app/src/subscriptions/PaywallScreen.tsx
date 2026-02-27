// app/src/subscriptions/PaywallScreen.tsx
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Purchases, { CustomerInfo, Package, PurchasesError } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import {
  configureRevenueCat,
  getCustomerInfo,
  rcIdentifyUser,
  restorePurchases,
} from "./rcClient";
import { getRevenueCatApiKey } from "./rcKeys";
import { useSubscription } from "./useSubscription";

function formatPrice(pkg: Package) {
  // @ts-ignore
  return pkg?.product?.priceString ?? "";
}

function getPkgTitle(pkg: Package) {
  // @ts-ignore
  return pkg?.product?.title ?? "Subscription";
}

function getPkgDescription(pkg: Package) {
  // @ts-ignore
  return pkg?.product?.description ?? "";
}

function safeStringify(obj: any, maxLen = 16000) {
  try {
    const s = JSON.stringify(obj, null, 2);
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + "\n…(truncated)…";
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

export default function PaywallScreen() {
  const router = useRouter();
  const {
    isPro,
    loading: subLoading,
    refresh: refreshHook,
    customerInfo: hookInfo,
  } = useSubscription();

  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);

  // Debug state
  const [dbgLoading, setDbgLoading] = useState(false);
  const [dbgLastUpdated, setDbgLastUpdated] = useState<string | null>(null);
  const [dbgError, setDbgError] = useState<string | null>(null);
  const [dbg, setDbg] = useState<any>(null);

  // Prevent hammering rcIdentifyUser on every refresh
  const lastIdentifyRef = useRef<string | null>(null);

  // ✅ Auto-dismiss paywall once Pro becomes active
  useEffect(() => {
    if (!subLoading && isPro) {
      try {
        // @ts-ignore
        if (router?.canGoBack?.()) router.back();
      } catch {}
    }
  }, [isPro, subLoading, router]);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    setOfferingsError(null);
    setPackages([]);

    try {
      const configured = await configureRevenueCat();
      if (!configured) {
        setOfferingsError("RevenueCat isn’t configured yet (missing API key).");
        return;
      }

      const offerings = await Purchases.getOfferings();
      const current = offerings?.current;

      if (!current) {
        setOfferingsError(
          "Offerings.current is missing. This usually means products/offering not fully linked in RevenueCat/Play Console yet."
        );
        return;
      }

      const pkgs = current.availablePackages ?? [];
      if (!pkgs.length) {
        setOfferingsError("No subscription packages found in current Offering.");
        return;
      }

      setPackages(pkgs);
    } catch (e: any) {
      const msg =
        e?.message ??
        (e as PurchasesError)?.toString?.() ??
        "Failed to load offerings.";
      setOfferingsError(msg);
    } finally {
      setOfferingsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const header = useMemo(() => {
    if (subLoading) return "Loading subscription…";
    if (isPro) return "✅ Pro is active";
    return "Go Pro (Debug Build)";
  }, [subLoading, isPro]);

  const buildDebugSnapshot = useCallback(async () => {
    setDbgLoading(true);
    setDbgError(null);

    try {
      const nowIso = new Date().toISOString();

      // App / env
      const apiKeyMasked = maskKey(getRevenueCatApiKey());
      const appOwnership = (Constants as any)?.appOwnership ?? null; // expo | standalone | guest
      const releaseChannel =
        (Constants as any)?.expoConfig?.extra?.eas?.releaseChannel ??
        (Constants as any)?.manifest2?.extra?.eas?.releaseChannel ??
        null;

      // Auth state
      const token = await SecureStore.getItemAsync("auth_token");
      const authUserRaw = await SecureStore.getItemAsync("auth_user");
      let authUser: any = null;
      try {
        authUser = authUserRaw ? JSON.parse(authUserRaw) : null;
      } catch {
        authUser = { parseError: true, raw: authUserRaw };
      }

      // RevenueCat
      const configured = await configureRevenueCat();
      const appUserId = configured ? await getAppUserIdCompat() : null;
      const isAnon = configured ? await getIsAnonymousCompat() : null;

      // Identify attempt (with DB user id)
      let identifyAttempt: any = null;
      const dbUserId = authUser?.id != null ? String(authUser.id) : null;

      if (configured && dbUserId) {
        // Only attempt identify when it changes (or first time)
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

      // Pull RC info (both hook + direct) so we can compare
      let directCustomerInfo: CustomerInfo | null = null;
      let directCustomerInfoErr: any = null;
      if (configured) {
        try {
          directCustomerInfo = await getCustomerInfo();
        } catch (e: any) {
          directCustomerInfoErr = String(e?.message ?? e);
        }
      }

      // Offerings snapshot (current, identifiers)
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

      // Final computed status
      const hookOriginalId = hookInfo?.originalAppUserId ?? null;
      const directOriginalId = directCustomerInfo?.originalAppUserId ?? null;

      const hookEnts = Object.keys(hookInfo?.entitlements?.active ?? {});
      const directEnts = Object.keys(directCustomerInfo?.entitlements?.active ?? {});

      const hookIsPro = !!hookInfo?.entitlements?.active?.[ENTITLEMENT_ID];
      const directIsPro = !!directCustomerInfo?.entitlements?.active?.[ENTITLEMENT_ID];

      const autoDismissReason = (() => {
        if (subLoading) return "Hook still loading (subLoading=true)";
        if (isPro) return "isPro=true (should dismiss)";
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
  }, [hookInfo, isPro, subLoading]);

  // Build one snapshot on mount so you instantly see state
  useEffect(() => {
    buildDebugSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const screenLoading = subLoading;

  if (screenLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>{header}</Text>
        <Text style={{ marginTop: 8, opacity: 0.65, textAlign: "center" }}>
          If this hangs forever, hit “Refresh Debug” once it renders.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{header}</Text>

      <Text style={{ marginTop: 8, opacity: 0.8 }}>
        This paywall is in debug mode and shows: anonymous ID, DB user id, entitlements, offerings,
        and why auto-dismiss did/didn’t trigger.
      </Text>

      {/* ===== Quick actions ===== */}
      <View style={{ height: 14 }} />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Pressable
          onPress={async () => {
            try {
              await refreshHook();
              await buildDebugSnapshot();
              Alert.alert("Refreshed", "Subscription + debug info refreshed.");
            } catch {}
          }}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "#111827",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>
            {dbgLoading ? "Refreshing…" : "Refresh Debug"}
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await loadOfferings();
            await buildDebugSnapshot();
          }}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "#E5E7EB",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontWeight: "900" }}>Reload Offerings</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            try {
              // @ts-ignore
              if (router?.canGoBack?.()) router.back();
              else router.replace("/(app)");
            } catch {}
          }}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: "#F3F4F6",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontWeight: "900" }}>Close</Text>
        </Pressable>
      </View>

      {dbgError ? (
        <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#FEF2F2" }}>
          <Text style={{ fontWeight: "900" }}>Debug error</Text>
          <Text style={{ marginTop: 6, opacity: 0.85 }}>{dbgError}</Text>
        </View>
      ) : null}

      {/* ===== Debug panel ===== */}
      <View style={{ height: 16 }} />

      <View style={{ padding: 14, borderRadius: 12, backgroundColor: "#F3F4F6" }}>
        <Text style={{ fontWeight: "900", fontSize: 16 }}>🔎 Debug Snapshot</Text>
        <Text style={{ marginTop: 6, opacity: 0.8 }}>Last updated: {dbgLastUpdated ?? "—"}</Text>

        <View style={{ height: 10 }} />

        <Text selectable style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 16 }}>
          {dbg ? safeStringify(dbg) : "(no debug snapshot yet)"}
        </Text>
      </View>

      <View style={{ height: 18 }} />

      {/* ===== Offerings / packages UI ===== */}
      <Text style={{ fontSize: 18, fontWeight: "800" }}>Plans</Text>
      <Text style={{ marginTop: 6, opacity: 0.75 }}>
        If plans are missing, Debug Snapshot will show whether Offerings.current is null.
      </Text>

      <View style={{ height: 12 }} />

      {offeringsLoading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading plans…</Text>
        </View>
      ) : offeringsError ? (
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: "#F3F4F6" }}>
          <Text style={{ fontWeight: "800" }}>Plans unavailable</Text>
          <Text style={{ marginTop: 8, opacity: 0.8 }}>{offeringsError}</Text>

          <View style={{ height: 12 }} />

          <Pressable
            onPress={loadOfferings}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              backgroundColor: "#111827",
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {packages.map((pkg) => (
            <View key={pkg.identifier} style={{ padding: 14, borderRadius: 12, backgroundColor: "#F3F4F6" }}>
              <Text style={{ fontSize: 16, fontWeight: "800" }}>{getPkgTitle(pkg)}</Text>

              {!!getPkgDescription(pkg) && (
                <Text style={{ marginTop: 6, opacity: 0.8 }}>{getPkgDescription(pkg)}</Text>
              )}

              <Text style={{ marginTop: 10, fontWeight: "900" }}>{formatPrice(pkg)}</Text>

              <Pressable
                onPress={async () => {
                  try {
                    const configured = await configureRevenueCat();
                    if (!configured) {
                      Alert.alert("Not ready", "RevenueCat isn’t configured yet.");
                      return;
                    }

                    await Purchases.purchasePackage(pkg);

                    // Pull everything again immediately after purchase
                    await refreshHook();
                    await buildDebugSnapshot();

                    Alert.alert(
                      "Purchase completed",
                      "If Pro didn’t activate, check entitlements + originalAppUserId in Debug Snapshot."
                    );
                  } catch (e: any) {
                    const msg = e?.message ?? "Purchase failed.";
                    if (String(msg).toLowerCase().includes("cancel")) return;
                    Alert.alert("Purchase error", msg);
                    try {
                      await buildDebugSnapshot();
                    } catch {}
                  }
                }}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: "#111827",
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800" }}>Subscribe</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 18 }} />

      {/* Restore */}
      <Pressable
        onPress={async () => {
          try {
            await restorePurchases();
            await refreshHook();
            await buildDebugSnapshot();
            Alert.alert("Restored", "Purchases restored (if any). Check Debug Snapshot for entitlements.");
          } catch (e: any) {
            Alert.alert("Restore failed", e?.message ?? "Restore failed.");
            try {
              await buildDebugSnapshot();
            } catch {}
          }
        }}
        style={{
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: "#E5E7EB",
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontWeight: "900" }}>Restore purchases</Text>
      </Pressable>

      <View style={{ height: 18 }} />

      {/* Force Identify */}
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

            Alert.alert("Forced identify", `Attempted RevenueCat logIn("${id}"). Check Debug Snapshot.`);
          } catch (e: any) {
            Alert.alert("Force identify failed", String(e?.message ?? e));
            try {
              await buildDebugSnapshot();
            } catch {}
          }
        }}
        style={{
          marginTop: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: "#F3F4F6",
          alignSelf: "flex-start",
        }}
      >
        <Text style={{ fontWeight: "900" }}>Force Identify (DB user id)</Text>
      </Pressable>
    </ScrollView>
  );
}