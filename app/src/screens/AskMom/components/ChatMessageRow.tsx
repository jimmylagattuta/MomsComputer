// app/src/screens/AskMom/components/ChatMessageRow.tsx
import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BRAND, FONT } from "../theme";
import ContactMomPanel from "./ContactMomPanel";
import ImagePreviewModal from "./ImagePreviewModal";
import type { ChatMessage } from "./types";

type AnyImageShape = string | { uri: string };

export default function ChatMessageRow({
  msg,
  thread,
  index,
}: {
  msg: ChatMessage;
  thread: ChatMessage[];
  index: number;
}) {
  const isUser = msg.role === "user";
  const isAssistant = !isUser;

  // ✅ normalize images so it works whether backend returns ["url", ...]
  // or your UI returns [{ uri }, ...]
  const images = useMemo(() => {
    const raw = (msg as any).images || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((im: AnyImageShape) => (typeof im === "string" ? { uri: im } : im))
      .filter((im: any) => !!im?.uri);
  }, [msg]);

  // ✅ full-screen zoomable preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const openViewer = (uri: string) => {
    setPreviewUri(uri);
    setPreviewOpen(true);
  };

  const closeViewer = () => {
    setPreviewOpen(false);
    setPreviewUri(null);
  };

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      {/* ✅ Full-screen zoomable preview (ChatGPT style) */}
      <ImagePreviewModal open={previewOpen} uri={previewUri} onClose={closeViewer} />

      <View style={[styles.metaRow, isUser ? styles.metaRight : styles.metaLeft]}>
        <Text style={styles.meta}>{isUser ? "You" : "Ask Mom"}</Text>
      </View>

      <View style={[styles.card, isUser ? styles.userCard : styles.momCard]}>
        <Text style={[styles.text, msg.pending && styles.pendingText]}>{msg.text}</Text>
      </View>

      {/* ✅ thumbnails under the message */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.thumbRow,
            isUser ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" },
          ]}
        >
          {images.map((im) => (
            <Pressable
              key={im.uri}
              onPress={() => openViewer(im.uri)}
              style={({ pressed }) => [styles.thumbWrap, pressed && { opacity: 0.92 }]}
            >
              <Image source={{ uri: im.uri }} style={styles.thumb} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ✅ Inline Contact Mom panel under the assistant message bubble */}
      {isAssistant && !msg.pending && (
        <ContactMomPanel
          visible={!!(msg as any).show_contact_panel}
          actions={(msg as any).contact_actions}
          phoneNumber={(msg as any).contact_targets?.phone || null}
          email={(msg as any).contact_targets?.email || null}
          draft={(msg as any).contact_draft || null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: "100%",
    gap: 6,
    marginBottom: 12,
  },
  rowLeft: { alignItems: "flex-start" },
  rowRight: { alignItems: "flex-end" },

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

  thumbRow: {
    gap: 10,
    paddingTop: 2,
    paddingBottom: 2,
  },

  thumbWrap: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },

  thumb: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
});
