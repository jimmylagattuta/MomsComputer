import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { FONT } from "../../../../src/theme";

const IS_ANDROID = Platform.OS === "android";

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

type HomeSettingsMenuProps = {
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenSubscription: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
};

export default function HomeSettingsMenu({
  open,
  disabled = false,
  onToggle,
  onClose,
  onOpenProfile,
  onOpenSubscription,
  onChangePassword,
  onLogout,
}: HomeSettingsMenuProps) {
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
    minWidth: 240,
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
});