// app/(app)/delete-account.tsx

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { deleteJson } from "../src/services/api/client";
import { FONT } from "../src/theme";

const IS_ANDROID = Platform.OS === "android";

const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  cardBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  danger: "#C62828",
  dangerDark: "#991B1B",
  dangerSoft: "#FFF5F5",
  warningBg: "#FFF8E7",
  warningBorder: "#F5C96B",
  warningText: "#8A5A00",
};

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpeningSubscriptions, setIsOpeningSubscriptions] = useState(false);

  const handleBack = () => {
    if (isDeleting) return;
    router.back();
  };

  const handleManageAppleSubscription = async () => {
    if (isOpeningSubscriptions || isDeleting) return;

    setIsOpeningSubscriptions(true);

    try {
      await Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
    } catch (error) {
      console.log("Unable to open Apple subscription settings:", error);

      Alert.alert(
        "Could not open subscriptions",
        "You can manage or cancel your Apple subscription from your Apple Account subscription settings."
      );
    } finally {
      setIsOpeningSubscriptions(false);
    }
  };

  const performDeleteAccount = async () => {
    if (isDeleting) return;

    setIsDeleting(true);

    try {
      const token = await SecureStore.getItemAsync("auth_token");

      if (!token) {
        await signOut();

        Alert.alert(
          "Please sign in again",
          "For your safety, please sign in again before deleting your account.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ]
        );

        return;
      }

      const res = await deleteJson("/v1/me", token);

      if (!res.ok) {
        const message =
          res.json?.message ||
          res.json?.error ||
          "We could not delete your account right now. Please try again.";

        throw new Error(message);
      }

      await signOut();

      Alert.alert("Account deleted", "Your account has been deleted.", [
        {
          text: "OK",
          onPress: () => router.replace("/(auth)/sign-in"),
        },
      ]);
    } catch (error: any) {
      console.log("Delete account failed:", error);

      Alert.alert(
        "Could not delete account",
        error?.message || "We could not delete your account right now. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    if (isDeleting) return;

    Alert.alert(
      "Delete account?",
      "This will close your Mom’s Computer account and sign you out. This cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: performDeleteAccount,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            disabled={isDeleting}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backButton,
              pressed && !isDeleting && styles.pressed,
              isDeleting && styles.disabled,
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={BRAND.text} />
          </Pressable>

          <Text style={styles.headerTitle}>Delete Account</Text>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconCircle}>
            <Ionicons name="trash-outline" size={34} color={BRAND.danger} />
          </View>

          <Text style={styles.title}>Delete your account?</Text>

          <Text style={styles.subtitle}>
            If you delete your Mom’s Computer account, you will be signed out
            and will no longer be able to use this account.
          </Text>

          <Text style={styles.cannotUndoText}>
            This cannot be undone.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What happens when you delete it</Text>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={BRAND.blue} />
              <Text style={styles.bulletText}>
                You will be signed out of the app.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={BRAND.blue} />
              <Text style={styles.bulletText}>
                Your account will be closed.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={20} color={BRAND.blue} />
              <Text style={styles.bulletText}>
                You will not be able to sign in with this account again.
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="information-circle-outline" size={20} color={BRAND.muted} />
              <Text style={styles.bulletText}>
                We may keep limited records if required for support, billing,
                safety, or legal reasons.
              </Text>
            </View>
          </View>

          <View style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="alert-circle-outline" size={22} color={BRAND.warningText} />
              <Text style={styles.warningTitle}>Important: Apple subscription</Text>
            </View>

            <Text style={styles.warningText}>
              Deleting your Mom’s Computer account does not cancel an active
              Apple subscription.
            </Text>

            <Text style={styles.warningText}>
              To stop future Apple billing, you must cancel your subscription
              through your Apple Account settings.
            </Text>

            <Pressable
              onPress={handleManageAppleSubscription}
              disabled={isDeleting || isOpeningSubscriptions}
              style={({ pressed }) => [
                styles.subscriptionButton,
                pressed && !isDeleting && !isOpeningSubscriptions && styles.pressed,
                (isDeleting || isOpeningSubscriptions) && styles.disabled,
              ]}
            >
              {isOpeningSubscriptions ? (
                <ActivityIndicator color={BRAND.blue} />
              ) : (
                <>
                  <Ionicons name="open-outline" size={19} color={BRAND.blue} />
                  <Text style={styles.subscriptionButtonText}>
                    Manage Apple Subscription
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={handleDeleteAccount}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && !isDeleting && styles.pressed,
              isDeleting && styles.disabled,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>Delete My Account</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleBack}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.cancelButton,
              pressed && !isDeleting && styles.pressed,
              isDeleting && styles.disabled,
            ]}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 17 : 18,
    letterSpacing: 0.2,
  },

  headerSpacer: {
    width: 42,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 34,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.dangerSoft,
    borderWidth: 1,
    borderColor: "#F3B4B4",
    marginBottom: 18,
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 25 : 28,
    lineHeight: IS_ANDROID ? 31 : 34,
    textAlign: "center",
    letterSpacing: 0.2,
  },

  subtitle: {
    marginTop: 10,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 14 : 15,
    lineHeight: IS_ANDROID ? 20 : 22,
    textAlign: "center",
  },

  cannotUndoText: {
    marginTop: 10,
    color: BRAND.dangerDark,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 14 : 15,
    lineHeight: IS_ANDROID ? 20 : 22,
    textAlign: "center",
  },

  card: {
    marginTop: 24,
    backgroundColor: BRAND.cardBg,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 16,
  },

  cardTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 17 : 18,
    marginBottom: 12,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
  },

  bulletText: {
    flex: 1,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 19 : 20,
  },

  warningCard: {
    marginTop: 16,
    backgroundColor: BRAND.warningBg,
    borderWidth: 1,
    borderColor: BRAND.warningBorder,
    borderRadius: 18,
    padding: 16,
  },

  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },

  warningTitle: {
    color: BRAND.warningText,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 16 : 17,
  },

  warningText: {
    color: BRAND.warningText,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 19 : 20,
    marginTop: 8,
  },

  subscriptionButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
  },

  subscriptionButtonText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 14 : 15,
  },

  deleteButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: BRAND.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
  },

  deleteButtonText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 15 : 16,
    letterSpacing: 0.2,
  },

  cancelButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 14 : 15,
  },

  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },

  disabled: {
    opacity: 0.6,
  },
});