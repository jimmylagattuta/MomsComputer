import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthProvider";
import { postJson } from "../../services/api/client";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
};

const FONT = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semi: "Inter-SemiBold",
};

const LOGO_URI =
  "https://res.cloudinary.com/djtsuktwb/image/upload/v1766530533/NON_M_copy_2_3_poheb7.jpg";

export default function HomeScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Responsive helpers
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const handleLogout = () => {
    if (isLoggingOut) return;

    Alert.alert(
      "Log out?",
      "You’ll need to sign in again to use Ask Mom.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              const token = await SecureStore.getItemAsync("auth_token");

              // Best-effort backend revoke (don’t block logout on network errors)
              if (token) {
                try {
                  await postJson("/v1/auth/logout", {}, token);
                } catch {}
              }

              await signOut();
              router.replace("/(auth)/sign-in");
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const MOM_PHONE = "+15625551234"; // TODO: replace with real number

  const handleCallMom = () => {
    Alert.alert(
      "Call Mom?",
      "This will place a phone call using your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          style: "default",
          onPress: () => {
            Linking.openURL(`tel:${MOM_PHONE}`).catch(() => {
              Alert.alert(
                "Unable to place call",
                "Your device couldn’t start a phone call."
              );
            });
          },
        },
      ],
      { cancelable: true }
    );
  };

  const bigBtnTextStyle = useMemo(
    () => [styles.bigBtnText, isNarrow && styles.bigBtnTextNarrow],
    [isNarrow]
  );

  return (
    <SafeAreaView style={styles.page}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: Math.max(insets.top, 10),
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            hitSlop={12}
            style={({ pressed }) => [
              styles.logoutChip,
              pressed && !isLoggingOut && styles.logoutChipPressed,
              isLoggingOut && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name="walk"
              size={22}
              color={BRAND.blue}
              style={{ transform: [{ scaleX: -1 }] }}
            />
            <Text style={styles.logoutChipText}>Logout</Text>
          </Pressable>
        </View>

        <View style={styles.main}>
          <View style={[styles.row, styles.rowFullBleed]}>
            <View style={styles.bannerRow}>
              <View style={styles.logoBanner} pointerEvents="none">
                <Image
                  source={{ uri: LOGO_URI }}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
            </View>
          </View>

          <View style={styles.actionsWrap}>
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push("/(app)/ask-mom")}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons
                    name="chatbubble-ellipses"
                    size={34}
                    color={BRAND.blue}
                  />
                </View>

                {/* Text wrap is IMPORTANT for Android truncation/shrinking */}
                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    ASK MOM
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(app)/text-mom")}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="mail" size={34} color={BRAND.blue} />
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    EMAIL / TEXT MOM
                  </Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleCallMom}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="call" size={34} color={BRAND.blue} />
                </View>

                <View style={styles.textWrap}>
                  <Text
                    style={bigBtnTextStyle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    ellipsizeMode="tail"
                  >
                    CALL MOM
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Ionicons name="home" size={24} color={BRAND.blue} />
          <Text style={styles.footerText}>Home</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const H_PADDING = 18;
const LOGO_ASPECT_RATIO = 2.32;

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
    paddingHorizontal: H_PADDING,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 6,
  },

  logoutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  logoutChipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  logoutChipText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 14,
    letterSpacing: 0.35,
  },

  main: { flex: 1, justifyContent: "flex-start" },

  row: { width: "100%", alignItems: "center" },

  rowFullBleed: { alignSelf: "stretch", alignItems: "stretch" },

  bannerRow: { width: "100%" },

  logoBanner: {
    marginLeft: -H_PADDING,
    marginRight: -H_PADDING,
    backgroundColor: "#FFFFFF",
    width: undefined,
    aspectRatio: LOGO_ASPECT_RATIO,
    overflow: "hidden",
    borderRadius: 14,
  },

  logo: { width: "100%", height: "100%" },

  actionsWrap: { flex: 1, justifyContent: "center" },

  actions: { width: "100%", gap: 12 },

  bigBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  bigBtnPressed: { transform: [{ scale: 0.99 }], opacity: 0.98 },

  iconPill: {
    width: 64,
    height: 40,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  // IMPORTANT: this wrapper + minWidth fixes Android text overflow in flex rows
  textWrap: {
    flex: 1,
    minWidth: 0,
  },

  bigBtnText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 24,
    letterSpacing: 1.0,
    flexShrink: 1,
  },

  // Reduce letterSpacing on narrow screens (helps Android a lot)
  bigBtnTextNarrow: {
    letterSpacing: 0.4,
  },

  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    gap: 4,
  },

  footerText: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 14,
    letterSpacing: 0.25,
  },
});
