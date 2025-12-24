// app/src/screens/TextMom/TextMomScreen.tsx
import { useRouter } from "expo-router";
import React from "react";
import {
    Alert,
    Image,
    Linking,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// ✅ Use the SAME theme module as AskMom so spacing/colors match
import HomeFooterButton from "../AskMom/components/HomeFooterButton";
import { BRAND, FONT, H_PADDING } from "../AskMom/theme";

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

// ✅ Header styled exactly like AskMomHeader, but with different text
function TextMomHeader() {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.headerText}>Text / Email</Text>

      <Image source={{ uri: MOM_LOGO_URI }} style={styles.momLogo} resizeMode="contain" />
    </View>
  );
}

export default function TextMomScreen() {
  const router = useRouter();

  // TODO: replace with real values (or pull from profile/settings later)
  const MOM_PHONE = "+15625551234";
  const MOM_EMAIL = "mom@example.com";

  const template = `Hey Mom — can you take a look at this? I’m not sure if it’s legit:\n\n[PASTE HERE]\n\nWhat do you think?`;

  const handleOpenText = () => {
    openUrlOrAlert(buildSmsUrl(MOM_PHONE, template));
  };

  const handleOpenEmail = () => {
    openUrlOrAlert(buildMailtoUrl(MOM_EMAIL, "Can you check if this is a scam?", template));
  };

  return (
    <SafeAreaView style={styles.page}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: 25,
            paddingBottom: 0,
            paddingHorizontal: H_PADDING,
          },
        ]}
      >
        {/* ✅ Same header style as AskMom */}
        <TextMomHeader />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Choose how to contact Mom</Text>
            <Text style={styles.cardBody}>
              Tap one option below. We’ll open your messaging app with a ready-to-paste template.
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
              Don’t include passwords, 2FA codes, SSNs, or bank numbers. If it asks for money or
              gift cards, pause and verify first.
            </Text>
          </View>

          <View style={{ height: 6 }} />
        </ScrollView>

        {/* ✅ Same footer component as AskMom */}
        <HomeFooterButton onPress={() => router.replace("/(app)")} />
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
    paddingBottom: 12,
    gap: 12,
  },

  // ✅ Header (matches AskMomHeader)
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
});
