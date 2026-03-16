// app/src/screens/TextMom/components/TextMomFooterHomeButton.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { FONT } from "../../../../src/theme";
import { BRAND } from "../../AskMom/theme";

type Props = {
  onPress: () => void;
  bottomInset: number;
};

export default function TextMomFooterHomeButton({
  onPress,
  bottomInset,
}: Props) {
  const FOOTER_MIN_HEIGHT = 56;
  const footerPaddingBottom = Math.max(bottomInset, 12) + 10;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.footer,
        {
          minHeight: FOOTER_MIN_HEIGHT,
          paddingBottom: footerPaddingBottom,
        },
      ]}
      hitSlop={10}
    >
      <Ionicons name="home" size={24} color={BRAND.blue} />
      <Text style={styles.footerText}>Home</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
    backgroundColor: BRAND.screenBg,
  },

  footerText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    letterSpacing: 0.25,
  },
});