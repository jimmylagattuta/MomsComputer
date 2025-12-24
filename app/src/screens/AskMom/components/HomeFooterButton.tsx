import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { BRAND, FONT } from "../theme";

export default function HomeFooterButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.footer, pressed && styles.footerPressed]}
      hitSlop={10}
    >
      <Ionicons name="home" size={22} color={BRAND.blue} />
      <Text style={styles.footerText}>Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 15,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
  },
  footerPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  footerText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    letterSpacing: 0.25,
  },
});