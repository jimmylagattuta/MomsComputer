import React from "react";
import { StyleSheet, Text, View } from "react-native";

const BRAND = { bg: "#0B1220", text: "#fff", muted: "#A7B0C0" };

export default function AskMomScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Ask Mom</Text>
      <Text style={styles.p}>
        Paste the message. I’ll tell you what it actually means. (Yes, it’s probably a scam.)
      </Text>
      <Text style={styles.note}>Next: input + “Get Guidance” + risk badge + steps.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BRAND.bg, padding: 16, gap: 10 },
  h1: { color: BRAND.text, fontSize: 22, fontWeight: "900" },
  p: { color: BRAND.muted, fontSize: 14, lineHeight: 20 },
  note: { color: BRAND.muted, fontSize: 12 },
});