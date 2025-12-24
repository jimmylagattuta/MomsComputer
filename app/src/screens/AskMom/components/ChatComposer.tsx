import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND, FONT } from "../theme";

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onClear,
  disabled,
  loading,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onClear: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Type your message…"
          placeholderTextColor="#98A2B3"
          style={styles.input}
          multiline
          textAlignVertical="top"
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => {
            if (!disabled) onSend();
          }}
        />

        <Pressable
          onPress={onSend}
          disabled={disabled}
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && styles.sendBtnPressed,
            disabled && styles.sendBtnDisabled,
          ]}
          hitSlop={10}
        >
          {loading ? (
            <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
          ) : (
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      <View style={styles.metaRow}>
        <Pressable
          onPress={onClear}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed && styles.clearBtnPressed,
          ]}
          hitSlop={10}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Don’t share passwords, login codes, SSN, or bank numbers. We will never ask.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingTop: 10,
    paddingBottom: 8,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 2,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
  },

  sendBtn: {
    height: 48,
    width: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blue,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  sendBtnPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  sendBtnDisabled: { opacity: 0.45 },

  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  clearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  clearBtnPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },

  clearText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  disclaimer: {
    flex: 1,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 16,
  },
});
