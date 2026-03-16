// app/src/screens/TextMom/components/TextMomHeader.tsx
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { FONT } from "../../../../src/theme";
import { BRAND } from "../../AskMom/theme";

const MOM_LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766549235/ChatGPT_Image_Dec_23_2025_08_06_16_PM_zfytp3.png";

type Props = {
  title: string;
};

export default function TextMomHeader({ title }: Props) {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.headerText}>{title}</Text>

      <Image
        source={{ uri: MOM_LOGO_URI }}
        style={styles.momLogo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingTop: 2,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  headerText: {
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