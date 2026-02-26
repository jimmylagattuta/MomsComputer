// app/src/subscriptions/rcKeys.ts
import Constants from "expo-constants";
import { Platform } from "react-native";

type Extra = {
  revenuecat?: {
    iosApiKey?: string;
    androidApiKey?: string;
  };
};

function getExtra(): Extra {
  return (Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {}) as Extra;
}

export function getRevenueCatApiKey(): string | null {
  const extra = getExtra();
  const iosKey = extra.revenuecat?.iosApiKey;
  const androidKey = extra.revenuecat?.androidApiKey;
  const key = Platform.OS === "ios" ? iosKey : androidKey;

  if (!key || typeof key !== "string" || key.trim().length === 0) return null;
  return key.trim();
}