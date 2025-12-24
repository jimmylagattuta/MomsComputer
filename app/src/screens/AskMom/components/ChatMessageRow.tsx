import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { BRAND, FONT } from "../theme";
import type { ChatMessage } from "./types";

export default function ChatMessageRow({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View style={[styles.metaRow, isUser ? styles.metaRight : styles.metaLeft]}>
        <Text style={styles.meta}>{isUser ? "You" : "Ask Mom"}</Text>
      </View>

      <View style={[styles.card, isUser ? styles.userCard : styles.momCard]}>
        <Text style={[styles.text, msg.pending && styles.pendingText]}>
          {msg.text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    gap: 6,
    marginBottom: 12,
  },
  rowLeft: {
    alignItems: "flex-start",
  },
  rowRight: {
    alignItems: "flex-end",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLeft: { justifyContent: "flex-start" },
  metaRight: { justifyContent: "flex-end" },

  meta: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
    letterSpacing: 0.15,
  },

  card: {
    maxWidth: "92%",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  // Subtle differentiation (still clean + senior friendly)
  momCard: {
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
  },

  userCard: {
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
  },

  text: {
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 14.5,
    lineHeight: 20,
  },

  pendingText: {
    color: BRAND.muted,
  },
});