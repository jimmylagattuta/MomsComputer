import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { BRAND, FONT } from "../theme";

const MOM_LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766549235/ChatGPT_Image_Dec_23_2025_08_06_16_PM_zfytp3.png";

export default function AskMomHeader() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.askText}>Ask</Text>

      <Image
        source={{ uri: MOM_LOGO_URI }}
        style={styles.momLogo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",          // ✅ row layout
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingTop: 2,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  askText: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 18,                  // slightly bigger for balance
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 0,                  // subtle baseline alignment
  },

  momLogo: {
    height: 80,                    // dominant but not oversized
    width: 80,
  },
});
