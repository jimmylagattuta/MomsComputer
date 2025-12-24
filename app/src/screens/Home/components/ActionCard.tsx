import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  title: string;
  subtitle: string;
  icon: string; // emoji for now (fast + fun)
  accent: "red" | "blue";
  onPress: () => void;
};

const BRAND = {
  bg: "#0B1220",
  card: "#10182A",
  border: "#25304A",
  text: "#FFFFFF",
  muted: "#A7B0C0",
  red: "#E33B4A",
  blue: "#2FA7FF",
};

export default function ActionCard({ title, subtitle, icon, accent, onPress }: Props) {
  const accentColor = accent === "red" ? BRAND.red : BRAND.blue;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={[styles.iconBubble, { borderColor: accentColor }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={[styles.chev, { borderColor: accentColor }]}>
          <Text style={[styles.chevText, { color: accentColor }]}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND.card,
    borderColor: BRAND.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1626",
  },
  icon: { fontSize: 20 },
  title: { color: BRAND.text, fontSize: 16, fontWeight: "900", letterSpacing: 0.2 },
  subtitle: { color: BRAND.muted, fontSize: 12.5, marginTop: 3, lineHeight: 17 },
  chev: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E1626",
  },
  chevText: { fontSize: 22, fontWeight: "900", marginTop: -1 },
});