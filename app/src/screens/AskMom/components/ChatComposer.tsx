// app/src/screens/AskMom/components/ChatComposer.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { BRAND, FONT } from "../theme";

type SpellResult = {
  corrected: string;
  changed: boolean;
  meaningfulChanged: boolean;
};

function normalizeForCompare(s: string) {
  return s
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function simpleSpellFix(input: string): SpellResult {
  const original = input;
  let s = input;

  // normalize whitespace (preserve newlines)
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .trim();

  // common typos
  const rules: Array<[RegExp, string]> = [
    [/\bteh\b/gi, "the"],
    [/\brecieve\b/gi, "receive"],
    [/\bdefinately\b/gi, "definitely"],
    [/\boccured\b/gi, "occurred"],
    [/\buntill\b/gi, "until"],
    [/\bwich\b/gi, "which"],
    [/\bthier\b/gi, "their"],
  ];
  for (const [re, rep] of rules) s = s.replace(re, rep);

  // first letter cap (tiny polish)
  s = s.replace(/^\s*([a-z])/, (m, c) => m.replace(c, c.toUpperCase()));

  // remove space before punctuation
  s = s.replace(/\s+([,.;!?])/g, "$1");

  const changed = s !== original;
  const meaningfulChanged =
    normalizeForCompare(s) !== normalizeForCompare(original);

  return { corrected: s, changed, meaningfulChanged };
}

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onClear,
  disabled,
  loading,
  hasConversation,
  messagesCount,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onClear: () => void;
  disabled: boolean;
  loading: boolean;
  hasConversation: boolean;
  messagesCount?: number;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [spellOpen, setSpellOpen] = useState(false);
  const [spellOriginal, setSpellOriginal] = useState("");
  const [spellSuggested, setSpellSuggested] = useState("");

  const sendGuardRef = useRef(false);

  const isClearAction = useMemo(() => {
    if (typeof messagesCount === "number") return messagesCount > 0;
    return !!hasConversation;
  }, [messagesCount, hasConversation]);

  const actuallySend = (textToSend: string) => {
    onChange(textToSend);

    requestAnimationFrame(() => {
      onSend();

      requestAnimationFrame(() => {
        onChange("");
      });

      sendGuardRef.current = false;
    });
  };

  const handleSendPress = () => {
    if (sendGuardRef.current) return;
    if (disabled || loading) return;

    const trimmed = value.trim();
    if (!trimmed) return;

    sendGuardRef.current = true;

    const { corrected, changed, meaningfulChanged } = simpleSpellFix(trimmed);

    // Only interrupt the user for REAL changes
    if (changed && meaningfulChanged) {
      setSpellOriginal(trimmed);
      setSpellSuggested(corrected);
      setSpellOpen(true);
      return;
    }

    // Formatting-only change? Send silently.
    actuallySend(changed ? corrected : trimmed);
  };

  const closeSpellModal = () => {
    setSpellOpen(false);
    sendGuardRef.current = false;
  };

  const handleSendOriginal = () => {
    setSpellOpen(false);
    actuallySend(spellOriginal);
  };

  const handleSendCorrected = () => {
    setSpellOpen(false);
    actuallySend(spellSuggested);
  };

  const handleClearPress = () => setConfirmOpen(true);
  const handleCancelClear = () => setConfirmOpen(false);

  const handleConfirmClear = () => {
    setConfirmOpen(false);
    onClear();
  };

  return (
    <View style={styles.wrap}>
      {/* Spellcheck modal */}
      <Modal
        visible={spellOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeSpellModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeSpellModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons name="sparkles" size={22} color={BRAND.blue} />
              <Text style={styles.modalTitle}>Fix typos before sending?</Text>
            </View>

            <Text style={styles.modalBody}>
              I found a small spelling fix. Which version should we send?
            </Text>

            <View style={styles.spellBox}>
              <Text style={styles.spellLabel}>Corrected</Text>
              <Text style={styles.spellText}>{spellSuggested}</Text>

              <View style={{ height: 10 }} />

              <Text style={styles.spellLabel}>Original</Text>
              <Text style={styles.spellTextMuted}>{spellOriginal}</Text>
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={handleSendOriginal}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnGhost,
                  pressed && styles.modalBtnPressed,
                ]}
              >
                <Text style={styles.modalBtnGhostText}>Send original</Text>
              </Pressable>

              <Pressable
                onPress={handleSendCorrected}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  pressed && styles.modalBtnPressed,
                ]}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.modalBtnPrimaryText}>Send corrected</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Clear modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={handleCancelClear}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancelClear}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={isClearAction ? "warning" : "information-circle"}
                size={22}
                color={isClearAction ? BRAND.red : BRAND.blue}
              />
              <Text style={styles.modalTitle}>
                {isClearAction ? "Clear this chat?" : "Nothing to clear"}
              </Text>
            </View>

            <Text style={styles.modalBody}>
              {isClearAction
                ? "This will permanently delete the current conversation. Are you sure?"
                : "There aren’t any messages in this thread yet."}
            </Text>

            <View style={styles.modalActions}>
              {isClearAction ? (
                <>
                  <Pressable
                    onPress={handleCancelClear}
                    style={({ pressed }) => [
                      styles.modalBtn,
                      styles.modalBtnGhost,
                      pressed && styles.modalBtnPressed,
                    ]}
                  >
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirmClear}
                    style={({ pressed }) => [
                      styles.modalBtn,
                      styles.modalBtnDanger,
                      pressed && styles.modalBtnPressed,
                    ]}
                  >
                    <Ionicons name="trash" size={16} color="#f70a0aff" />
                    <Text style={styles.modalBtnDangerText}>Yes, clear</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleCancelClear}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    styles.modalBtnGhost,
                    pressed && styles.modalBtnPressed,
                  ]}
                >
                  <Text style={styles.modalBtnGhostText}>OK</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
          onSubmitEditing={handleSendPress}
        />

        <Pressable
          onPress={handleSendPress}
          disabled={disabled}
          style={({ pressed }) => [
            styles.sendBtn,
            pressed && styles.sendBtnPressed,
            disabled && styles.sendBtnDisabled,
          ]}
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
          onPress={handleClearPress}
          style={({ pressed }) => [
            styles.clearBtn,
            pressed && styles.clearBtnPressed,
          ]}
        >
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Don’t share passwords, login codes, SSN, or bank numbers. We will never
          ask.
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontFamily: FONT.medium,
    fontSize: 16,
    color: "#0B1220",
  },
  modalBody: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#334155",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 140,
    flexDirection: "row",
    gap: 8,
  },
  modalBtnGhost: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
  },
  modalBtnPrimary: {
    backgroundColor: BRAND.blue,
    borderColor: BRAND.blue,
  },
  modalBtnDanger: {
    backgroundColor: BRAND.red,
    borderColor: BRAND.red,
  },
  modalBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  modalBtnGhostText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: "#0B1220",
  },
  modalBtnPrimaryText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: "#FFFFFF",
  },
  modalBtnDangerText: {
    fontFamily: FONT.medium,
    fontSize: 14,
    color: "#000000ff",
  },
  spellBox: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  spellLabel: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: "#0B1220",
    marginBottom: 6,
  },
  spellText: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#0B1220",
  },
  spellTextMuted: {
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
    color: "#475569",
  },
});
