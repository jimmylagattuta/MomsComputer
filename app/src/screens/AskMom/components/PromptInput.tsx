import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND, FONT } from "../theme";

export default function PromptInput({
  value,
  onChange,
  onSend,
  onClear,
  disabledSend,
  disabledClear,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onClear: () => void;
  disabledSend: boolean;
  disabledClear: boolean;
}) {
  return (
    <View style={styles.card}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Type your message…"
        placeholderTextColor="#98A2B3"
        multiline
        textAlignVertical="top"
        style={styles.textarea}
      />

      <View style={styles.row}>
        <Pressable
          onPress={onSend}
          disabled={disabledSend}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && styles.primaryBtnPressed,
            disabledSend && styles.primaryBtnDisabled,
          ]}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>ASK MOM</Text>
        </Pressable>

        <Pressable
          onPress={onClear}
          disabled={disabledClear}
          style={({ pressed }) => [
            styles.ghostBtn,
            pressed && styles.ghostBtnPressed,
            disabledClear && styles.ghostBtnDisabled,
          ]}
        >
          <Text style={styles.ghostBtnText}>Clear</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>
        Don’t share passwords, login codes, SSN, or bank numbers. We will never ask.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    padding: 14,

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,

    gap: 10,
  },

  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  row: { flexDirection: "row", gap: 10, alignItems: "center" },

  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: BRAND.blue,
  },

  primaryBtnPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  primaryBtnDisabled: { opacity: 0.5 },

  primaryBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 14,
    letterSpacing: 1.1,
  },

  ghostBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  ghostBtnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ghostBtnDisabled: { opacity: 0.6 },

  ghostBtnText: { color: BRAND.blue, fontFamily: FONT.medium, fontSize: 14 },

  disclaimer: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});