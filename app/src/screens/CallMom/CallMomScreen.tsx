import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { postJson } from "../../services/api/client";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueDark: "#1557B0",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
};

function formatPhoneForTel(phone?: string | null) {
  const value = String(phone || "").trim();

  if (!value) return null;

  return value.replace(/[^\d+]/g, "");
}

function buildCallUnavailableMessage(backendMessage?: string | null) {
  const cleanMessage = String(backendMessage || "").trim();

  if (cleanMessage) {
    return `${cleanMessage}\n\nIf this is urgent or you believe this is a mistake, please contact Mom’s Computer another way or ask a trusted family member for help.`;
  }

  return "You have used your support calls for this month.\n\nIf this is urgent or you believe this is a mistake, please contact Mom’s Computer another way or ask a trusted family member for help.";
}

export default function CallMomScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const [isCalling, setIsCalling] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isBlockedMessage, setIsBlockedMessage] = useState(false);

  const titleStyle = useMemo(
    () => [styles.title, isNarrow && styles.titleNarrow],
    [isNarrow]
  );

  const openSupportDialer = async (callNumber: string) => {
    const formattedNumber = formatPhoneForTel(callNumber);

    if (!formattedNumber) {
      throw new Error("The support phone number was not available. Please try again.");
    }

    const telUrl = `tel:${formattedNumber}`;
    const canOpen = await Linking.canOpenURL(telUrl);

    if (!canOpen) {
      throw new Error("This phone cannot open the dialer right now.");
    }

    await Linking.openURL(telUrl);
  };

  const handleStartCall = async () => {
    if (isCalling) return;

    try {
      setIsCalling(true);
      setLastMessage(null);
      setIsBlockedMessage(false);

      const secureStoreToken = await SecureStore.getItemAsync("auth_token");

      if (!secureStoreToken) {
        const signInMessage = "Please sign in again first.";

        setLastMessage(signInMessage);
        setIsBlockedMessage(true);

        Alert.alert(
          "Please Sign In",
          "Please sign in again, then tap Call Support."
        );

        return;
      }

      const response = await postJson("/v1/support_calls", {}, secureStoreToken);

      const backendMessage =
        response?.json?.message ||
        response?.json?.error ||
        "You cannot start a support call right now.";

      if (!response?.ok || !response?.json?.success) {
        const detailedMessage = buildCallUnavailableMessage(backendMessage);

        setLastMessage(detailedMessage);
        setIsBlockedMessage(true);

        Alert.alert("Call Not Available", detailedMessage);

        return;
      }

      const callNumber = response?.json?.call_number;

      if (!callNumber) {
        const missingNumberMessage =
          "The support phone number was not available.\n\nPlease try again in a moment.";

        setLastMessage(missingNumberMessage);
        setIsBlockedMessage(true);

        Alert.alert("Call Not Available", missingNumberMessage);

        return;
      }

      setLastMessage("Opening your phone app now…");
      setIsBlockedMessage(false);

      await openSupportDialer(callNumber);
    } catch (error: any) {
      const message =
        error?.message ||
        "We could not open the phone app right now. Please try again.";

      setLastMessage(message);
      setIsBlockedMessage(true);

      Alert.alert("Unable to Call", message);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={21} color={BRAND.blue} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="call" size={42} color={BRAND.blue} />
            </View>

            <Text style={titleStyle}>Need help right now?</Text>

            <Text style={styles.mainText}>Tap the button below.</Text>

            <Text style={styles.supportText}>
              We’ll help you figure out what to do next.
            </Text>
          </View>

          <View style={styles.reassuranceCard}>
            <Ionicons name="shield-checkmark" size={24} color={BRAND.green} />

            <View style={styles.reassuranceTextWrap}>
              <Text style={styles.reassuranceTitle}>You are not alone.</Text>

              <Text style={styles.reassuranceText}>
                If something feels wrong, confusing, or suspicious, call us.
              </Text>
            </View>
          </View>

          {lastMessage ? (
            <View style={[styles.statusCard, isBlockedMessage && styles.blockedStatusCard]}>
              <Ionicons
                name={isBlockedMessage ? "alert-circle" : "checkmark-circle"}
                size={22}
                color={isBlockedMessage ? BRAND.red : BRAND.blue}
              />

              <Text style={[styles.statusText, isBlockedMessage && styles.blockedStatusText]}>
                {lastMessage}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleStartCall}
            disabled={isCalling}
            style={({ pressed }) => [
              styles.callBtn,
              pressed && !isCalling && styles.callBtnPressed,
              isCalling && styles.callBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isCalling ? "Opening support call" : "Call support now"}
          >
            {isCalling ? (
              <>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.callBtnText}>Opening Call…</Text>
              </>
            ) : (
              <>
                <Ionicons name="call" size={30} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Call Support</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footerNote}>Tap once. Your phone app will open.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BRAND.pageBg,
  },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 18,
  },

  headerRow: {
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignSelf: "flex-start",
  },

  backBtnPressed: {
    opacity: 0.85,
  },

  backText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 16,
  },

  content: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: "center",
    gap: 18,
  },

  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    paddingVertical: 34,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
    alignItems: "center",
  },

  iconCircle: {
    width: 86,
    height: 86,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 20,
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 34,
    lineHeight: 40,
    textAlign: "center",
  },

  titleNarrow: {
    fontSize: 30,
    lineHeight: 36,
  },

  mainText: {
    marginTop: 18,
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 24,
    lineHeight: 32,
    textAlign: "center",
  },

  supportText: {
    marginTop: 10,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 18,
    lineHeight: 27,
    textAlign: "center",
  },

  reassuranceCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BRAND.greenBorder,
    backgroundColor: BRAND.greenSoft,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  reassuranceTextWrap: {
    flex: 1,
    gap: 4,
  },

  reassuranceTitle: {
    color: "#166534",
    fontFamily: FONT.medium,
    fontSize: 18,
    lineHeight: 24,
  },

  reassuranceText: {
    color: "#166534",
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 23,
  },

  statusCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  blockedStatusCard: {
    borderColor: BRAND.redBorder,
    backgroundColor: BRAND.redSoft,
  },

  statusText: {
    flex: 1,
    color: BRAND.blueDark,
    fontFamily: FONT.medium,
    fontSize: 16,
    lineHeight: 23,
  },

  blockedStatusText: {
    color: "#991B1B",
  },

  footer: {
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: BRAND.screenBg,
    gap: 10,
  },

  callBtn: {
    minHeight: 78,
    borderRadius: 24,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    shadowColor: BRAND.blue,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },

  callBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },

  callBtnDisabled: {
    opacity: 0.72,
  },

  callBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 26,
    letterSpacing: 0.2,
  },

  footerNote: {
    textAlign: "center",
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 21,
    paddingHorizontal: 10,
  },
});