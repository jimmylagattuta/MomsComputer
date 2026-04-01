import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "../src/theme";

const IS_ANDROID = Platform.OS === "android";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  gold: "#B7791F",
  goldSoft: "#FFF8E7",
  goldBorder: "#F4D58D",
};

type BenefitCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
};

function BenefitCard({ icon, title, text }: BenefitCardProps) {
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitIconWrap}>
        <Ionicons name={icon} size={22} color={BRAND.blue} />
      </View>

      <View style={styles.benefitTextWrap}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitText}>{text}</Text>
      </View>
    </View>
  );
}

export default function SubscriptionPrivilegesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={BRAND.blue} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="diamond" size={16} color={BRAND.gold} />
              <Text style={styles.heroBadgeText}>Mom&apos;s Computer</Text>
            </View>

            <Text style={styles.title}>Your Subscription Privileges</Text>
            <Text style={styles.subtitle}>
              Straightforward support for moments that feel confusing, suspicious, or urgent.
            </Text>

            <View style={styles.priceCard}>
              <Text style={styles.priceAmount}>$9.99</Text>
              <Text style={styles.priceSuffix}>per month</Text>
            </View>
          </View>

          <View style={styles.section}>
            <BenefitCard
              icon="sparkles-outline"
              title="Ask Mom AI Help"
              text="Get guided help when something feels suspicious, confusing, or urgent."
            />

            <BenefitCard
              icon="call-outline"
              title="3 Call Moms Per Month"
              text="Talk to a real person up to three times each month when live reassurance matters most."
            />

            <BenefitCard
              icon="mail-outline"
              title="Text Mom Feature"
              text="Send non-urgent questions and details through text or email-style support."
            />
          </View>
        </ScrollView>
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
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  topBar: {
    paddingBottom: 8,
  },

  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  backBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  backBtnText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
  },

  scrollContent: {
    paddingBottom: 28,
  },

  heroCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: 24,
    backgroundColor: BRAND.goldSoft,
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
    alignItems: "center",
  },

  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
    marginBottom: 14,
  },

  heroBadgeText: {
    color: BRAND.gold,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 12 : 13,
    letterSpacing: 0.2,
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 28 : 30,
    letterSpacing: 0.2,
    textAlign: "center",
  },

  subtitle: {
    marginTop: 8,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 14 : 15,
    lineHeight: IS_ANDROID ? 20 : 22,
    textAlign: "center",
    maxWidth: 420,
  },

  priceCard: {
    marginTop: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.goldBorder,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 170,
  },

  priceAmount: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 34 : 38,
    letterSpacing: 0.3,
    textAlign: "center",
  },

  priceSuffix: {
    marginTop: 4,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    textAlign: "center",
  },

  section: {
    marginTop: 16,
    gap: 12,
  },

  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },

  benefitIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  benefitTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  benefitTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 15 : 16,
    letterSpacing: 0.15,
  },

  benefitText: {
    marginTop: 5,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 18 : 20,
  },
});