import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FONT } from "../../../../src/theme";

const IS_ANDROID = Platform.OS === "android";

const TERMS_URL = "https://momscomputer.com/terms/";
const PRIVACY_URL = "https://momscomputer.com/privacy/";

const BRAND = {
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  gold: "#B7791F",
  goldSoft: "#FFF8E7",
  dangerSoft: "#FFF5F5",
  dangerText: "#C62828",
};

type ExternalLinkTarget = {
  label: string;
  url: string;
};

type HomeSettingsMenuProps = {
  open: boolean;
  disabled?: boolean;

  // Current monthly call usage display
  currentCallsThisMonth?: number | null;
  monthlyCallLimit?: number | null;

  onToggle: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenSubscription: () => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
};

export default function HomeSettingsMenu({
  open,
  disabled = false,
  currentCallsThisMonth = null,
  monthlyCallLimit = null,
  onToggle,
  onClose,
  onOpenProfile,
  onOpenSubscription,
  onChangePassword,
  onDeleteAccount,
  onLogout,
}: HomeSettingsMenuProps) {
  const [externalLinkTarget, setExternalLinkTarget] =
    useState<ExternalLinkTarget | null>(null);

  const handleOpenExternalConfirm = (target: ExternalLinkTarget) => {
    setExternalLinkTarget(target);
    onClose();
  };

  const handleCancelExternalLink = () => {
    setExternalLinkTarget(null);
  };

  const handleConfirmExternalLink = async () => {
    if (!externalLinkTarget?.url) return;

    const urlToOpen = externalLinkTarget.url;

    setExternalLinkTarget(null);

    try {
      await Linking.openURL(urlToOpen);
    } catch (error) {
      console.log("Unable to open external link:", error);
    }
  };

  const hasCallUsageNumbers =
    typeof currentCallsThisMonth === "number" &&
    typeof monthlyCallLimit === "number";

  const callsRemaining = hasCallUsageNumbers
    ? Math.max(monthlyCallLimit - currentCallsThisMonth, 0)
    : null;

  const callsRemainingTitle =
    typeof callsRemaining === "number"
      ? `${callsRemaining} ${
          callsRemaining === 1 ? "Call" : "Calls"
        } Remaining This Month`
      : "Monthly Calls";

  const callsUsedSubtext = hasCallUsageNumbers
    ? `${currentCallsThisMonth} of ${monthlyCallLimit} monthly calls used`
    : "Monthly phone support usage";

  return (
    <View style={styles.settingsWrap}>
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        hitSlop={12}
        style={({ pressed }) => [
          styles.settingsChip,
          pressed && !disabled && styles.settingsChipPressed,
          disabled && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="person-circle-outline" size={28} color={BRAND.blue} />
      </Pressable>

      {open && !disabled && (
        <>
          <Pressable style={styles.dropdownBackdrop} onPress={onClose} />

          <View style={styles.dropdownMenu}>
            <Pressable
              onPress={onOpenProfile}
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownItemPressed,
              ]}
            >
              <Ionicons name="person-outline" size={20} color={BRAND.blue} />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>Profile</Text>
                <Text style={styles.dropdownItemSubtext}>
                  View your basic account info
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={onOpenSubscription}
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownGoldPressed,
              ]}
            >
              <Ionicons name="diamond-outline" size={20} color={BRAND.gold} />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>Subscription</Text>
                <Text style={styles.dropdownItemSubtext}>
                  View plan privileges
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.dropdownItem}>
              <Ionicons name="call-outline" size={20} color={BRAND.blue} />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>
                  {callsRemainingTitle}
                </Text>
                <Text style={styles.dropdownItemSubtext}>
                  {callsUsedSubtext}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Pressable
              onPress={() =>
                handleOpenExternalConfirm({
                  label: "Privacy Policy",
                  url: PRIVACY_URL,
                })
              }
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownItemPressed,
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={BRAND.blue}
              />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>Privacy Policy</Text>
                <Text style={styles.dropdownItemSubtext}>
                  Opens momscomputer.com
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={() =>
                handleOpenExternalConfirm({
                  label: "Terms",
                  url: TERMS_URL,
                })
              }
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownItemPressed,
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={20}
                color={BRAND.blue}
              />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>Terms</Text>
                <Text style={styles.dropdownItemSubtext}>
                  Opens momscomputer.com
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={onChangePassword}
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownItemPressed,
              ]}
            >
              <Ionicons name="key-outline" size={20} color={BRAND.blue} />
              <View style={styles.textBlock}>
                <Text style={styles.dropdownItemText}>Change Password</Text>
                <Text style={styles.dropdownItemSubtext}>
                  Update your current password
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={onDeleteAccount}
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownDangerPressed,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={20}
                color={BRAND.dangerText}
              />
              <View style={styles.textBlock}>
                <Text
                  style={[styles.dropdownItemText, { color: BRAND.dangerText }]}
                >
                  Delete Account
                </Text>
                <Text style={styles.dropdownItemSubtext}>
                  Permanently delete your account
                </Text>
              </View>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              onPress={onLogout}
              style={({ pressed }) => [
                styles.dropdownItem,
                pressed && styles.dropdownDangerPressed,
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={20}
                color={BRAND.dangerText}
              />
              <View style={styles.textBlock}>
                <Text
                  style={[styles.dropdownItemText, { color: BRAND.dangerText }]}
                >
                  Logout
                </Text>
                <Text style={styles.dropdownItemSubtext}>
                  Sign out of this device
                </Text>
              </View>
            </Pressable>
          </View>
        </>
      )}

      <Modal
        visible={!!externalLinkTarget}
        transparent
        animationType="fade"
        onRequestClose={handleCancelExternalLink}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="open-outline" size={24} color={BRAND.blue} />
            </View>

            <Text style={styles.modalTitle}>Open outside the app?</Text>

            <Text style={styles.modalBody}>
              You are about to leave Mom&apos;s Computer and open{" "}
              {externalLinkTarget?.label} in your browser.
            </Text>

            <Text style={styles.modalUrl}>{externalLinkTarget?.url}</Text>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleCancelExternalLink}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalCancelButton,
                  pressed && styles.modalButtonPressed,
                ]}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmExternalLink}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalConfirmButton,
                  pressed && styles.modalButtonPressed,
                ]}
              >
                <Text style={styles.modalConfirmText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  settingsWrap: {
    position: "relative",
    zIndex: 60,
    alignItems: "flex-end",
  },

  settingsChip: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  settingsChipPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  dropdownBackdrop: {
    position: "absolute",
    top: -20,
    right: -20,
    bottom: -600,
    left: -320,
    zIndex: 1,
  },

  dropdownMenu: {
    position: "absolute",
    top: 52,
    right: 0,
    minWidth: 250,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 2,
  },

  divider: {
    height: 1,
    backgroundColor: "#EEF2F7",
    marginVertical: 4,
    marginHorizontal: 10,
  },

  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },

  dropdownItemPressed: {
    backgroundColor: BRAND.blueSoft,
  },

  dropdownGoldPressed: {
    backgroundColor: BRAND.goldSoft,
  },

  dropdownDangerPressed: {
    backgroundColor: BRAND.dangerSoft,
  },

  textBlock: {
    flex: 1,
    minWidth: 0,
  },

  dropdownItemText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 14 : 15,
    letterSpacing: 0.2,
  },

  dropdownItemSubtext: {
    marginTop: 2,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 11 : 12,
    lineHeight: IS_ANDROID ? 14 : 15,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 18, 32, 0.42)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },

  modalIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 14,
  },

  modalTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 18 : 19,
    letterSpacing: 0.2,
  },

  modalBody: {
    marginTop: 8,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 19 : 20,
  },

  modalUrl: {
    marginTop: 12,
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 12 : 13,
    lineHeight: IS_ANDROID ? 17 : 18,
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },

  modalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  modalCancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  modalConfirmButton: {
    backgroundColor: BRAND.blue,
    borderWidth: 1,
    borderColor: BRAND.blue,
  },

  modalButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },

  modalCancelText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
  },

  modalConfirmText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
  },
});