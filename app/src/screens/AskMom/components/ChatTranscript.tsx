import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND, FONT } from "../theme";
import type { ChatMessage } from "./types";

export default function ChatTranscript({
  messages,
  loading,
}: {
  messages: ChatMessage[];
  loading: boolean;
}) {
  if (messages.length === 0 && !loading) return null;

  return (
    <View style={styles.card}>
      {messages.map((m) => {
        const isUser = m.role === "user";
        return (
          <View
            key={m.id}
            style={[
              styles.msgWrap,
              isUser ? styles.msgRight : styles.msgLeft,
            ]}
          >
            <Text style={[styles.label, isUser ? styles.labelRight : styles.labelLeft]}>
              {isUser ? "You" : "Ask Mom"}
            </Text>

            <View style={[styles.msgBox, isUser ? styles.userBox : styles.momBox]}>
              <Text style={styles.msgText}>{m.text}</Text>
            </View>
          </View>
        );
      })}

      {loading && (
        <View style={[styles.msgWrap, styles.msgLeft]}>
          <Text style={[styles.label, styles.labelLeft]}>Ask Mom</Text>
          <View style={[styles.msgBox, styles.momBox]}>
            <Text style={styles.msgText}>Thinking…</Text>
          </View>
        </View>
      )}
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

    gap: 12,
  },

  msgWrap: {
    maxWidth: "92%",
    gap: 6,
  },

  msgLeft: {
    alignSelf: "flex-start",
  },

  msgRight: {
    alignSelf: "flex-end",
  },

  label: {
    fontFamily: FONT.medium,
    fontSize: 12,
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },

  labelLeft: { color: BRAND.muted, textAlign: "left" },
  labelRight: { color: BRAND.muted, textAlign: "right" },

  msgBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  momBox: {
    backgroundColor: "#FFFFFF",
    borderColor: BRAND.border,
  },

  userBox: {
    backgroundColor: BRAND.blueSoft,
    borderColor: BRAND.blueBorder,
  },

  msgText: {
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 14.5,
    lineHeight: 20,
  },
});