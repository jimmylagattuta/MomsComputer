// app/src/screens/AskMom/components/ChatMessageRow.tsx
import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BRAND, FONT } from "../theme";
import ContactMomPanel from "./ContactMomPanel";
import type { ChatMessage } from "./types";

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

  const images = useMemo(() => msg.images || [], [msg.images]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const openViewer = (uri: string) => {
    setViewerUri(uri);
    setViewerOpen(true);
  };

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerUri(null);
  };

  return (
    <View style={[styles.row, isUser ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[styles.metaRow, isUser ? styles.metaRight : styles.metaLeft]}
      >
        <Text style={styles.meta}>{isUser ? "You" : "Ask Mom"}</Text>
      </View>

      <View style={[styles.card, isUser ? styles.userCard : styles.momCard]}>
        <Text style={[styles.text, msg.pending && styles.pendingText]}>
          {msg.text}
        </Text>
      </View>

      {/* ✅ thumbnails under the message */}
      {images.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.thumbRow,
            isUser
              ? { justifyContent: "flex-end" }
              : { justifyContent: "flex-start" },
          ]}
        >
          {images.map((im) => (
            <Pressable
              key={im.uri}
              onPress={() => openViewer(im.uri)}
              style={({ pressed }) => [
                styles.thumbWrap,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Image source={{ uri: im.uri }} style={styles.thumb} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ✅ Inline Contact Mom panel under the assistant message bubble */}
      {isAssistant && !msg.pending && (
        <ContactMomPanel
          visible={!!msg.show_contact_panel}
          actions={msg.contact_actions}
          phoneNumber={msg.contact_targets?.phone || null}
          email={msg.contact_targets?.email || null}
          draft={msg.contact_draft || null}
        />
      )}

      {/* ✅ Fullscreen image viewer */}
      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <Pressable style={styles.viewerBackdrop} onPress={closeViewer}>
          <Pressable style={styles.viewerCard} onPress={() => {}}>
            {viewerUri ? (
              <Image source={{ uri: viewerUri }} style={styles.viewerImage} />
            ) : null}

            <Pressable
              onPress={closeViewer}
              style={styles.viewerClose}
              hitSlop={12}
            >
              <Text style={styles.viewerCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  viewerCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  viewerImage: {
    width: "100%",
    height: 520,
    resizeMode: "contain",
    backgroundColor: "rgba(0,0,0,0.45)",
  },

  viewerClose: {
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  viewerCloseText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 14,
  },
});
