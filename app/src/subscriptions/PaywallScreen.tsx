// app/src/subscriptions/PaywallScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Purchases, { Package, PurchasesError } from "react-native-purchases";
import { configureRevenueCat, restorePurchases } from "./rcClient";
import { useSubscription } from "./useSubscription";

function formatPrice(pkg: Package) {
  // pkg.product.priceString exists on recent versions
  // fallback defensively
  // @ts-ignore
  return pkg?.product?.priceString ?? "";
}

function getPkgTitle(pkg: Package) {
  // @ts-ignore
  const title = pkg?.product?.title ?? "Subscription";
  return title;
}

function getPkgDescription(pkg: Package) {
  // @ts-ignore
  const desc = pkg?.product?.description ?? "";
  return desc;
}

export default function PaywallScreen() {
  const { isPro, loading: subLoading, refresh } = useSubscription();

  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);

  const loadOfferings = useCallback(async () => {
    setOfferingsLoading(true);
    setOfferingsError(null);
    setPackages([]);

    try {
      const configured = await configureRevenueCat();
      if (!configured) {
        setOfferingsError(
          "RevenueCat isn’t configured yet (missing API key)."
        );
        return;
      }

      const offerings = await Purchases.getOfferings();
      const current = offerings?.current;

      if (!current) {
        setOfferingsError(
          "Offerings are unavailable right now. (This is normal until Google Play products are set up + linked in RevenueCat.)"
        );
        return;
      }

      const pkgs = current.availablePackages ?? [];
      if (!pkgs.length) {
        setOfferingsError(
          "No subscription packages found in the current Offering."
        );
        return;
      }

      setPackages(pkgs);
    } catch (e: any) {
      // RevenueCat will throw ConfigurationError until Play products are attached.
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
    // Try once on mount (won't crash even if Offerings aren't configured)
    loadOfferings();
  }, [loadOfferings]);

  const screenLoading = subLoading;

  const header = useMemo(() => {
    if (screenLoading) return "Loading subscription…";
    if (isPro) return "✅ Pro is active";
    return "Go Pro";
  }, [screenLoading, isPro]);

  if (screenLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>{header}</Text>
      </View>
    );
  }

  if (isPro) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700" }}>{header}</Text>
        <Text style={{ marginTop: 8, textAlign: "center" }}>
          You’re subscribed. Enjoy premium access.
        </Text>

        <Pressable
          onPress={async () => {
            await refresh();
            Alert.alert("Refreshed", "Subscription status refreshed.");
          }}
          style={{
            marginTop: 18,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            backgroundColor: "#111827",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Refresh</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>{header}</Text>
      <Text style={{ marginTop: 8, opacity: 0.8 }}>
        Choose a plan to unlock premium access.
      </Text>

      <View style={{ height: 16 }} />

      {/* Offerings State */}
      {offeringsLoading ? (
        <View style={{ paddingVertical: 20, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 10 }}>Loading plans…</Text>
        </View>
      ) : offeringsError ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "#F3F4F6",
          }}
        >
          <Text style={{ fontWeight: "800" }}>Plans unavailable</Text>
          <Text style={{ marginTop: 8, opacity: 0.8 }}>
            {offeringsError}
          </Text>

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
            <Text style={{ color: "white", fontWeight: "800" }}>
              Try again
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {packages.map((pkg) => (
            <View
              key={pkg.identifier}
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800" }}>
                {getPkgTitle(pkg)}
              </Text>

              {!!getPkgDescription(pkg) && (
                <Text style={{ marginTop: 6, opacity: 0.8 }}>
                  {getPkgDescription(pkg)}
                </Text>
              )}

              <Text style={{ marginTop: 10, fontWeight: "900" }}>
                {formatPrice(pkg)}
              </Text>

              <Pressable
                onPress={async () => {
                  try {
                    const configured = await configureRevenueCat();
                    if (!configured) {
                      Alert.alert(
                        "Not ready",
                        "RevenueCat isn’t configured yet."
                      );
                      return;
                    }
                    await Purchases.purchasePackage(pkg);
                    await refresh();
                    Alert.alert("Success", "Purchase completed.");
                  } catch (e: any) {
                    // User cancellations are normal; don’t scare them.
                    const msg = e?.message ?? "Purchase failed.";
                    if (String(msg).toLowerCase().includes("cancel")) return;
                    Alert.alert("Purchase error", msg);
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
                <Text style={{ color: "white", fontWeight: "800" }}>
                  Subscribe
                </Text>
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
            await refresh();
            Alert.alert("Restored", "Purchases restored (if any).");
          } catch (e: any) {
            Alert.alert("Restore failed", e?.message ?? "Restore failed.");
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
    </ScrollView>
  );
}