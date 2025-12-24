// app/src/screens/Home/HomeScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Image,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/AuthProvider";

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

// Thin, clean typography (make sure these are loaded via expo-font)
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

  const handleLogout = async () => {
    await signOut();
    router.replace("/(auth)/sign-in");
  };

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
        {/* Top utility row */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={handleLogout}
            hitSlop={12}
            style={({ pressed }) => [
              styles.logoutChip,
              pressed && styles.logoutChipPressed,
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

        {/* MAIN */}
        <View style={styles.main}>
          {/* LOGO */}
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

          {/* ACTIONS (centered between logo and footer) */}
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
                <Text style={styles.bigBtnText}>ASK MOM</Text>
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
                <Text style={styles.bigBtnText}>EMAIL / TEXT MOM</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(app)/call-mom")}
                style={({ pressed }) => [
                  styles.bigBtn,
                  pressed && styles.bigBtnPressed,
                ]}
              >
                <View style={styles.iconPill}>
                  <Ionicons name="call" size={34} color={BRAND.blue} />
                </View>
                <Text style={styles.bigBtnText}>CALL MOM</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* FOOTER */}
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

  main: {
    flex: 1,
    justifyContent: "flex-start",
  },

  row: {
    width: "100%",
    alignItems: "center",
  },

  rowFullBleed: {
    alignSelf: "stretch",
    alignItems: "stretch",
  },

  bannerRow: {
    width: "100%",
  },

  logoBanner: {
    marginLeft: -H_PADDING,
    marginRight: -H_PADDING,
    backgroundColor: "#FFFFFF",
    width: undefined,
    aspectRatio: LOGO_ASPECT_RATIO,
    overflow: "hidden",
    borderRadius: 14,
  },

  logo: {
    width: "100%",
    height: "100%",
  },

  actionsWrap: {
    flex: 1,
    justifyContent: "center",
  },

  actions: {
    width: "100%",
    gap: 12,
  },

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

  bigBtnPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.98,
  },

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

  bigBtnText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 24,
    letterSpacing: 1.0,
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
