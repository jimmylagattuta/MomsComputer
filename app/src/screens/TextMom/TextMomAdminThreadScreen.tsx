import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import {
    fetchAdminSupportMessages,
    fetchAdminSupportThread,
    sendAdminSupportMessage,
    type AdminSupportTextMessage,
    type AdminSupportTextThreadSummary,
} from "../../services/api/supportAdminTextThreads";

const BRAND = {
  pageBg: "#08101D",
  shellTop: "#0D1728",
  screenBg: "#F8FBFF",
  border: "#D9E2EC",
  text: "#0F172A",
  muted: "#64748B",
  mutedSoft: "#94A3B8",
  blue: "#1D6FE9",
  blueDark: "#1259C8",
  blueSoft: "#EEF5FF",
  blueBorder: "#D6E7FF",
  green: "#16A34A",
  red: "#DC2626",
  bubbleMine: "#1D6FE9",
  bubbleMineText: "#FFFFFF",
  bubbleTheirs: "#FFFFFF",
  bubbleTheirsText: "#111827",
  bubbleSystemBg: "#EEF4FF",
  bubbleSystemBorder: "#C9DBFF",
};

function formatMetaTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getDisplayName(thread: AdminSupportTextThreadSummary | null) {
  if (!thread) return "Support thread";

  const snap = thread.support_identity_snapshot || {};
  return (
    snap.name ||
    [snap.first_name, snap.last_name].filter(Boolean).join(" ").trim() ||
    snap.email ||
    snap.phone ||
    `User #${thread.id}`
  );
}

export default function TextMomAdminThreadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const threadId = Number(params.threadId);

  const flatListRef = useRef<FlatList<AdminSupportTextMessage>>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<AdminSupportTextThreadSummary | null>(null);
  const [messages, setMessages] = useState<AdminSupportTextMessage[]>([]);
  const [draft, setDraft] = useState("");

  const titleStyle = useMemo(
    () => [styles.title, isNarrow && styles.titleNarrow],
    [isNarrow]
  );

  const sendDisabled = sending || !draft.trim();

  const loadThread = async () => {
    try {
      setLoading(true);

      const [threadRow, messageRows] = await Promise.all([
        fetchAdminSupportThread(threadId),
        fetchAdminSupportMessages(threadId),
      ]);

      setThread(threadRow);
      setMessages(messageRows);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to load support thread.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!threadId || Number.isNaN(threadId)) {
      Alert.alert("Invalid thread", "Missing thread id.");
      router.back();
      return;
    }

    void loadThread();
  }, [threadId]);

  useEffect(() => {
    if (!messages.length) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    try {
      setSending(true);
      const created = await sendAdminSupportMessage(threadId, trimmed, []);
      setDraft("");
      setMessages((prev) => [...prev, created]);
    } catch (e: any) {
      Alert.alert("Send failed", e?.message || "Unable to send reply.");
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: AdminSupportTextMessage }) => {
    const mine = item.direction === "inbound_from_support";
    const system = item.direction === "system";

    return (
      <View
        style={[
          styles.messageRow,
          system
            ? styles.messageRowSystem
            : mine
            ? styles.messageRowMine
            : styles.messageRowTheirs,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            system
              ? styles.messageBubbleSystem
              : mine
              ? styles.messageBubbleMine
              : styles.messageBubbleTheirs,
          ]}
        >
          {system ? (
            <View style={styles.systemHeaderRow}>
              <View style={styles.systemIconWrap}>
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color={BRAND.blueDark}
                />
              </View>
              <Text style={styles.systemLabel}>System</Text>
            </View>
          ) : null}

          {!!item.body && (
            <Text
              style={[
                styles.messageText,
                system
                  ? styles.messageTextSystem
                  : mine
                  ? styles.messageTextMine
                  : styles.messageTextTheirs,
              ]}
            >
              {item.body}
            </Text>
          )}

          {!!item.images?.length && (
            <View style={styles.imageGrid}>
              {item.images.map((img) => (
                <Image
                  key={img.id}
                  source={{ uri: img.url }}
                  style={styles.messageImage}
                />
              ))}
            </View>
          )}

          <View style={styles.messageMetaRow}>
            <Text
              style={[
                styles.messageMeta,
                system
                  ? styles.messageMetaSystem
                  : mine
                  ? styles.messageMetaMine
                  : styles.messageMetaTheirs,
              ]}
            >
              {system
                ? "System"
                : mine
                ? item.author_agent_name || "Support"
                : "User"}
              {item.created_at ? ` • ${formatMetaTime(item.created_at)}` : ""}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.shellTop} />

        <View style={styles.screen}>
          <View style={styles.headerWrap}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.headerBtnPressed,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={BRAND.blue} />
            </Pressable>

            <View style={styles.headerTitleWrap}>
              <View style={styles.badgeRow}>
                <View style={styles.liveDot} />
                <Text style={styles.badgeText}>Live support thread</Text>
              </View>

              <Text style={titleStyle}>{getDisplayName(thread)}</Text>

              <Text style={styles.headerSubtitle}>
                {thread?.assigned_agent_name
                  ? `Assigned to ${thread.assigned_agent_name}`
                  : "Support conversation"}
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <View style={styles.loadingOrb}>
                <ActivityIndicator size="large" color={BRAND.blue} />
              </View>
              <Text style={styles.loadingTitle}>Opening thread…</Text>
              <Text style={styles.loadingText}>
                Getting the latest messages ready.
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />

              <View style={styles.composerOuter}>
                <View style={styles.composerWrap}>
                  <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    placeholder="Reply as support..."
                    placeholderTextColor={BRAND.mutedSoft}
                    multiline
                    style={styles.input}
                    textAlignVertical="top"
                  />

                  <Pressable
                    onPress={handleSend}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      sendDisabled && styles.sendBtnDisabled,
                      pressed && !sendDisabled && styles.sendBtnPressed,
                    ]}
                    disabled={sendDisabled}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Ionicons name="arrow-up" size={18} color="#FFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BRAND.pageBg,
  },

  shellTop: {
    height: 18,
    backgroundColor: BRAND.shellTop,
  },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BRAND.border,
    overflow: "hidden",
  },

  headerWrap: {
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  headerBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },

  headerTitleWrap: {
    flex: 1,
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: BRAND.green,
  },

  badgeText: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 28,
    lineHeight: 32,
  },

  titleNarrow: {
    fontSize: 24,
    lineHeight: 28,
  },

  headerSubtitle: {
    marginTop: 3,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
  },

  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  loadingOrb: {
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 14,
  },

  loadingTitle: {
    fontFamily: FONT.medium,
    color: BRAND.text,
    fontSize: 18,
    marginBottom: 6,
  },

  loadingText: {
    fontFamily: FONT.regular,
    color: BRAND.muted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  messagesList: {
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
  },

  messageRow: {
    marginBottom: 14,
  },

  messageRowMine: {
    alignItems: "flex-end",
  },

  messageRowTheirs: {
    alignItems: "flex-start",
  },

  messageRowSystem: {
    alignItems: "center",
  },

  messageBubble: {
    maxWidth: "84%",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  messageBubbleMine: {
    backgroundColor: BRAND.bubbleMine,
    borderBottomRightRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  messageBubbleTheirs: {
    backgroundColor: BRAND.bubbleTheirs,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: "#E7EEF5",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  messageBubbleSystem: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: BRAND.bubbleSystemBg,
    borderWidth: 1,
    borderColor: BRAND.bubbleSystemBorder,
    borderRadius: 20,
    paddingVertical: 13,
  },

  systemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  systemIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCEAFF",
  },

  systemLabel: {
    color: BRAND.blueDark,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  messageText: {
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 22,
  },

  messageTextMine: {
    color: BRAND.bubbleMineText,
  },

  messageTextTheirs: {
    color: BRAND.bubbleTheirsText,
  },

  messageTextSystem: {
    color: "#274690",
  },

  messageMetaRow: {
    marginTop: 8,
  },

  messageMeta: {
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  messageMetaMine: {
    color: "rgba(255,255,255,0.82)",
  },

  messageMetaTheirs: {
    color: "#6B7280",
  },

  messageMetaSystem: {
    color: "#5570B8",
  },

  imageGrid: {
    marginTop: 10,
    gap: 8,
  },

  messageImage: {
    width: 190,
    height: 190,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
  },

  composerOuter: {
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
    paddingTop: 2,
    backgroundColor: BRAND.screenBg,
  },

  composerWrap: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EBF4",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
    marginTop: 6,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EBF4",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 20,
    color: BRAND.text,
    backgroundColor: "#FAFCFF",
  },

  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blue,
  },

  sendBtnPressed: {
    backgroundColor: BRAND.blueDark,
    transform: [{ scale: 0.97 }],
  },

  sendBtnDisabled: {
    opacity: 0.45,
  },
});