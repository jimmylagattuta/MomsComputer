import Constants from "expo-constants";
import React from "react";
import { ScrollView, Text } from "react-native";

export default function DebugRC() {
  const extra = (Constants.expoConfig?.extra ?? (Constants as any).manifest2?.extra ?? {}) as any;

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Debug RevenueCat</Text>
      <Text style={{ marginTop: 12, fontWeight: "700" }}>extra keys:</Text>
      <Text>{Object.keys(extra).join(", ")}</Text>

      <Text style={{ marginTop: 12, fontWeight: "700" }}>extra.revenuecat exists?</Text>
      <Text>{String(!!extra.revenuecat)}</Text>

      <Text style={{ marginTop: 12, fontWeight: "700" }}>iOS key present?</Text>
      <Text>{String(!!extra?.revenuecat?.iosApiKey)}</Text>

      <Text style={{ marginTop: 12, fontWeight: "700" }}>android key present?</Text>
      <Text>{String(!!extra?.revenuecat?.androidApiKey)}</Text>

      <Text style={{ marginTop: 12, fontWeight: "700" }}>raw revenuecat object:</Text>
      <Text selectable>{JSON.stringify(extra?.revenuecat ?? null, null, 2)}</Text>
    </ScrollView>
  );
}