import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { BRAND, FONT } from "../theme";
import HamburgerButton from "./HamburgerButton";

const MOM_LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766549235/ChatGPT_Image_Dec_23_2025_08_06_16_PM_zfytp3.png";

type AskMomHeaderProps = {
  onOpenHistory: () => void;
};

export default function AskMomHeader({ onOpenHistory }: AskMomHeaderProps) {
  return (
    <View style={styles.container}>
      {/* LEFT SLOT */}
      <View style={styles.left}>
        <HamburgerButton onPress={onOpenHistory} />
      </View>

      {/* CENTER SLOT (true visual center) */}
      <View style={styles.center}>
        <Text style={styles.askText}>Ask</Text>
        <Image
          source={{ uri: MOM_LOGO_URI }}
          style={styles.momLogo}
          resizeMode="contain"
        />
      </View>

      {/* RIGHT SLOT (reserved for symmetry / future use) */}
      <View style={styles.right} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",

    paddingTop: 2,
    paddingBottom: 2,

    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  left: {
    width: 56, // balances right side so center is TRUE center
    alignItems: "center",
    justifyContent: "center",
  },

  right: {
    width: 56, // must match left for perfect centering
  },

  center: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  askText: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 18,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 0,
  },

  momLogo: {
    height: 80,
    width: 80,
  },
});
