import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../auth/AuthProvider";
import { FONT } from "../../theme";
import { BRAND, H_PADDING } from "../AskMom/theme";
import TextMomAdminScreen from "./TextMomAdminScreen";
import TextMomUserScreen from "./TextMomUserScreen";

const MOM_LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766549235/ChatGPT_Image_Dec_23_2025_08_06_16_PM_zfytp3.png";

function openUrlOrAlert(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert("Couldn’t open", "Your device couldn’t open that app right now.");
  });
}

function buildMailtoUrl(email: string, subject: string, body: string) {
  const s = encodeURIComponent(subject);
  const b = encodeURIComponent(body);
  return `mailto:${email}?subject=${s}&body=${b}`;
}

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
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const auth = useAuth() as any;
  const user = auth?.user;
  const isAdmin = user?.role === "admin";

  const deepLinkThreadIdRaw = Array.isArray(params.threadId)
    ? params.threadId[0]
    : params.threadId;

  const hasDeepLinkThreadId = useMemo(() => {
    if (!deepLinkThreadIdRaw) return false;
    const n = Number(deepLinkThreadIdRaw);
    return Number.isFinite(n) && n > 0;
  }, [deepLinkThreadIdRaw]);

  const [showTextScreen, setShowTextScreen] = useState(hasDeepLinkThreadId);

  useEffect(() => {
    if (hasDeepLinkThreadId) {
      setShowTextScreen(true);
    }
  }, [hasDeepLinkThreadId]);

  if (isAdmin) {
    return <TextMomAdminScreen />;
  }

  if (showTextScreen) {
    return <TextMomUserScreen />;
  }

  const MOM_EMAIL = "elijah@momscomputer.com";

  const template = `Hey Mom — can you take a look at this? I’m not sure if it’s legit:\n\n[PASTE HERE]\n\nI’m here with you. Take your time and email me what you’re seeing.`;

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
              paddingBottom: footerTotalHeight + 12,
              flexGrow: 1,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose how to reach Mom</Text>
            <Text style={styles.cardBody}>
              Open the text platform to continue the conversation, or use the
              email feature if that fits better.
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={() => setShowTextScreen(true)}
                style={({ pressed }) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  pressed && styles.actionBtnPressed,
                ]}
                hitSlop={10}
              >
                <Text style={styles.actionBtnPrimaryText}>Text Mom</Text>
                <Text style={styles.actionBtnSub}>Opens live text</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  openUrlOrAlert(
                    buildMailtoUrl(
                      MOM_EMAIL,
                      "Can you check if this is a scam?",
                      template
                    )
                  )
                }
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
              Mom&apos;s Computer will never ask for your password, login codes,
              SSN, or bank information through chat or email.
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.scamBadge}>
            <Ionicons name="shield-checkmark" size={44} color={BRAND.blue} />
            <Text style={styles.scamBadgeText}>
              Mom&apos;s Scam Helpline{"\n"}Since 2
              <Text style={styles.scamBadgeZero}>0</Text>13
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={{ height: 6 }} />
        </ScrollView>

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

  actionBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

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