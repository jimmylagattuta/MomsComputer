import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function HamburgerButton({
  onPress,
  disabled,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Open history"
      style={({ pressed }) => [
        styles.outer,
        pressed && !disabled && styles.pressedOuter,
        disabled && styles.disabled,
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.icon}>
          <View style={[styles.line, styles.lineTop]} />
          <View style={[styles.line, styles.lineMid]} />
          <View style={[styles.line, styles.lineBot]} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** OUTER BORDER LAYER */
  outer: {
    height: 40,
    width: 44,
    borderRadius: 16,
    padding: 1.5, // creates layered border effect

    backgroundColor: "#E6EAF2", // soft outer border tone

    // iOS shadow
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },

    // Android shadow
    elevation: 2,
  },

  /** INNER SURFACE */
  inner: {
    flex: 1,
    borderRadius: 14,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#FFFFFF",

    // subtle inner highlight ring
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },

  pressedOuter: {
    transform: [{ scale: 0.97 }],
    shadowOpacity: 0.04,
    elevation: 1,
  },

  disabled: {
    opacity: 0.5,
  },

  icon: {
    width: 18,
    gap: 4,
  },

  line: {
    height: 2,
    borderRadius: 2,
    backgroundColor: "#111827",
  },

  lineTop: { width: 16, opacity: 0.92 },
  lineMid: { width: 18, opacity: 0.92 },
  lineBot: { width: 14, opacity: 0.92 },
});
