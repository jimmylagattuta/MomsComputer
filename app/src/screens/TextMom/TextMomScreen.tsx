import React from "react";
import { StyleSheet, Text, View } from "react-native";

const BRAND = { bg: "#0B1220", text: "#fff", muted: "#A7B0C0" };

export default function TextMomScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Text / Email Mom</Text>
      <Text style={styles.p}>
        Forward it here. I’ll read the “urgent action required” nonsense so you don’t have to.
      </Text>
      <Text style={styles.note}>Next: message composer + sms/mailto deep links.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 16, gap: 10 },
  h1: { color: BRAND.text, fontSize: 22, fontWeight: "900" },
  p: { color: BRAND.muted, fontSize: 14, lineHeight: 20 },
  note: { color: BRAND.muted, fontSize: 12 },
});