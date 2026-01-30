// app/src/screens/AskMom/components/ChatComposer.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BRAND, FONT } from "../theme";
import ImagePreviewModal from "./ImagePreviewModal";

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

  // first letter cap
  s = s.replace(/^\s*([a-z])/, (m, c) => m.replace(c, c.toUpperCase()));

  // remove space before punctuation
  s = s.replace(/\s+([,.;!?])/g, "$1");

  const changed = s !== original;
  const meaningfulChanged =
    normalizeForCompare(s) !== normalizeForCompare(original);

  return { corrected: s, changed, meaningfulChanged };
}

// ✅ Optional image shape (local preview only for now)
export type ComposerImage = {
  uri: string;
  loading?: boolean; // ✅ show placeholder + spinner until thumbnail loads
};

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onClear,
  disabled,
  loading,
  hasConversation,
  messagesCount,

  images = [],
  onPressAddImage,
  onRemoveImage,

  onImageLoaded,
}: {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onClear: () => void;
  disabled: boolean;
  loading: boolean;
  hasConversation: boolean;
  messagesCount?: number;

  images?: ComposerImage[];
  onPressAddImage?: () => void;
  onRemoveImage?: (uri: string) => void;

  onImageLoaded?: (uri: string) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [spellOpen, setSpellOpen] = useState(false);
  const [spellOriginal, setSpellOriginal] = useState("");
  const [spellSuggested, setSpellSuggested] = useState("");

  // ✅ full-screen preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const sendGuardRef = useRef(false);

  const safeImages = Array.isArray(images) ? images : [];
  const hasImages = safeImages.length > 0;

  const isClearAction = useMemo(() => {
    if (typeof messagesCount === "number") return messagesCount > 0;
    return !!hasConversation;
  }, [messagesCount, hasConversation]);

  const openPreview = (uri: string) => {
    setPreviewUri(uri);
    setPreviewOpen(true);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setPreviewUri(null);
  };

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

    const trimmed = (value || "").trim();
    if (!trimmed && !hasImages) return;

    sendGuardRef.current = true;

    if (!trimmed && hasImages) {
      actuallySend("");
      return;
    }

    const { corrected, changed, meaningfulChanged } = simpleSpellFix(trimmed);

    if (changed && meaningfulChanged) {
      setSpellOriginal(trimmed);
      setSpellSuggested(corrected);
      setSpellOpen(true);
      return;
    }

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
      {/* ✅ Full-screen zoomable preview */}
      <ImagePreviewModal open={previewOpen} uri={previewUri} onClose={closePreview} />

      {hasImages && (
        <View style={styles.previewRow}>
          {safeImages.map((img) => (
            <Pressable
              key={img.uri}
              onPress={() => openPreview(img.uri)}
              style={({ pressed }) => [
                styles.previewTile,
                pressed ? { opacity: 0.92, transform: [{ scale: 0.99 }] } : null,
              ]}
            >
              <Image
                source={{ uri: img.uri }}
                style={styles.previewImg}
                onLoadEnd={() => onImageLoaded?.(img.uri)}
              />

              {img.loading ? (
                <View style={styles.previewLoadingOverlay} pointerEvents="none">
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}

              {onRemoveImage && (
                <Pressable
                  onPress={() => onRemoveImage(img.uri)}
                  hitSlop={10}
                  style={styles.previewRemove}
                >
                  <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                </Pressable>
              )}
            </Pressable>
          ))}
        </View>
      )}

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
          <Pressable style={styles.modalCard}>
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
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostText}>Send original</Text>
              </Pressable>

              <Pressable
                onPress={handleSendCorrected}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
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
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={isClearAction ? "warning" : "information-circle"}
                size={22}
                color={isClearAction ? BRAND.red : BRAND.blue}
              />
              <Text style={styles.modalTitle}>
                {isClearAction ? "Start fresh?" : "Nothing to clear"}
              </Text>
            </View>

            <Text style={styles.modalBody}>
              {isClearAction
                ? "I'll clear our chat so we can begin again."
                : "There aren’t any messages in this thread yet."}
            </Text>

            <View style={styles.modalActions}>
              {isClearAction ? (
                <>
                  <Pressable
                    onPress={handleCancelClear}
                    style={[styles.modalBtn, styles.modalBtnGhost]}
                  >
                    <Text style={styles.modalBtnGhostText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirmClear}
                    style={[styles.modalBtn, styles.modalBtnDanger]}
                  >
                    <Ionicons name="trash" size={16} color="#000" />
                    <Text style={styles.modalBtnDangerText}>Start Fresh</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={handleCancelClear}
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                >
                  <Text style={styles.modalBtnGhostText}>OK</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* INPUT ROW */}
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

        <View style={styles.rightActions}>
          <Pressable
            onPress={onPressAddImage}
            disabled={!onPressAddImage}
            hitSlop={10}
            style={({ pressed }) => [
              styles.attachBtn,
              pressed && { opacity: 0.92 },
              !onPressAddImage && { opacity: 0.45 },
            ]}
          >
            <Ionicons name="image" size={18} color={BRAND.blue} />
          </Pressable>

          <Pressable
            onPress={handleSendPress}
            disabled={disabled && !hasImages}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.sendBtnPressed,
              disabled && !hasImages && styles.sendBtnDisabled,
            ]}
          >
            {loading ? (
              <Ionicons name="ellipsis-horizontal" size={18} color="#FFFFFF" />
            ) : (
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Pressable onPress={handleClearPress} style={styles.clearBtn}>
          <Text style={styles.clearText}>Clear</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          I’ll never ask for your password, login codes, SSN, or bank info. This
          app can help you spot scam tactics, but it is not financial advice.
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

  previewRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 2,
    paddingBottom: 10,
    flexWrap: "wrap",
  },
  previewTile: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  previewImg: { width: "100%", height: "100%", resizeMode: "cover" },
  previewRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  previewLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 2,
  },

  rightActions: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  attachBtn: {
    height: 48,
    width: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
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
    color: "#000",
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
