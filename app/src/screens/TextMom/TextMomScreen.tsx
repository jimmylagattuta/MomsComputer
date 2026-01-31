// app/src/screens/TextMom/TextMomScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { BRAND, H_PADDING } from "../AskMom/theme";

const MOM_LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766549235/ChatGPT_Image_Dec_23_2025_08_06_16_PM_zfytp3.png";

function openUrlOrAlert(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Couldn’t open", "Your device couldn’t open that app right now.");
  });
}

// SMS body param differs by platform:
// iOS uses sms:&body=
// Android uses sms:?body=
function buildSmsUrl(phone: string, body: string) {
  const encodedBody = encodeURIComponent(body);
  const sep = Platform.OS === "ios" ? "&" : "?";
  const normalized = phone.replace(/[^\d+]/g, "");
  return `sms:${normalized}${sep}body=${encodedBody}`;
}

function buildMailtoUrl(email: string, subject: string, body: string) {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  return `mailto:${email}?subject=${s}&body=${b}`;
}

// ✅ Header styled like AskMomHeader, but with different text
function TextMomHeader() {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.headerText}>Text / Email</Text>

      <Image
        source={{ uri: MOM_LOGO_URI }}
        style={styles.momLogo}
        resizeMode="contain"
      />
    </View>
  );
}

export default function TextMomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // TODO: replace with real values (or pull from profile/settings later)
  const MOM_PHONE = "+15625551234";
  const MOM_EMAIL = "mom@example.com";

  const template = `Hey Mom — can you take a look at this? I’m not sure if it’s legit:\n\n[PASTE HERE]\n\nI’m here with you. Take your time and text me what you’re seeing.`;

  const handleOpenText = () => {
    openUrlOrAlert(buildSmsUrl(MOM_PHONE, template));
  };

  const handleOpenEmail = () => {
    openUrlOrAlert(
      buildMailtoUrl(MOM_EMAIL, "Can you check if this is a scam?", template)
    );
  };

  /**
   * ✅ Bottom Home button:
   * - Absolute footer
   * - Safe-area padded
   * - ScrollView gets bottom padding so content never hides behind it
   */
  const FOOTER_MIN_HEIGHT = 56;
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: 12,
            paddingBottom: 10,
            paddingHorizontal: H_PADDING,
          },
        ]}
      >
        <TextMomHeader />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            {
              // ✅ keep everything above the absolute footer
              paddingBottom: footerTotalHeight + 12,
              flexGrow: 1, // ✅ allows spacers to fill remaining height
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose how to contact Mom</Text>
            <Text style={styles.cardBody}>
              Tap one option below. We’ll open your messaging app with a
              ready-to-paste template.
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={handleOpenText}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPressed,
                ]}
                hitSlop={10}
              >
                <Text style={styles.actionBtnPrimaryText}>Text Mom</Text>
                <Text style={styles.actionBtnSub}>Opens SMS</Text>
              </Pressable>

              <Pressable
                onPress={handleOpenEmail}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnGhost,
                  pressed && styles.actionBtnPressed,
                ]}
                hitSlop={10}
              >
                <Text style={styles.actionBtnGhostText}>Email Mom</Text>
                <Text style={styles.actionBtnSubGhost}>Opens email</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Tip</Text>
            <Text style={styles.tipBody}>
              I’ll never ask for your password, login codes, SSN, or bank info.
            </Text>
          </View>

          {/* ✅ Spacer ABOVE badge */}
          <View style={{ flex: 1 }} />

          {/* ✅ Scam Helpline badge (now centered in the remaining space) */}
          <View style={styles.scamBadge}>
            <Ionicons name="shield-checkmark" size={44} color={BRAND.blue} />
            <Text style={styles.scamBadgeText}>
              Mom&apos;s Scam Helpline{"\n"}Since 2
              <Text style={styles.scamBadgeZero}>0</Text>13
            </Text>
          </View>

          {/* ✅ Spacer BELOW badge (equal flex to the one above) */}
          <View style={{ flex: 1 }} />

          <View style={{ height: 6 }} />
        </ScrollView>

        {/* ✅ Footer matches HomeScreen */}
        <Pressable
          onPress={() => router.replace("/(app)")}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.pageBg },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  content: {
    paddingTop: 12,
    gap: 12,
  },

  // ✅ Header
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

  card: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 14,
  },

  cardTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 6,
    fontFamily: FONT.medium,
  },

  cardBody: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    fontFamily: FONT.regular,
  },

  actions: {
    gap: 10,
  },

  actionBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },

  actionBtnPrimary: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },

  actionBtnGhost: {
    backgroundColor: BRAND.inputBg,
    borderColor: BRAND.border,
  },

  actionBtnPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },

  actionBtnPrimaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 2,
    fontFamily: FONT.medium,
  },

  actionBtnGhostText: {
    color: BRAND.text,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 2,
    fontFamily: FONT.medium,
  },

  actionBtnSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    fontFamily: FONT.regular,
  },

  actionBtnSubGhost: {
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    fontFamily: FONT.regular,
  },

  tipCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 14,
  },

  tipTitle: {
    color: BRAND.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 6,
    fontFamily: FONT.medium,
  },

  tipBody: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },

  // ✅ Scam badge (in-flow, centered by the equal flex spacers)
  scamBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 6,
    backgroundColor: BRAND.screenBg,
  },

  scamBadgeText: {
    fontSize: 20,
    color: BRAND.muted,
    fontFamily: FONT.medium,
    textAlign: "center",
    lineHeight: 22,
  },

  scamBadgeZero: {
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
    }),
  },

  // ✅ Footer (HomeScreen style)
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
