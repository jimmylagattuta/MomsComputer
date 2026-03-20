import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import {
  fetchAdminSupportMessages,
  fetchAdminSupportThread,
  fetchAdminSupportThreads,
  sendAdminSupportMessage,
  type AdminSupportTextMessage,
  type AdminSupportTextThreadSummary,
} from "../../services/api/supportAdminTextThreads";
import ImagePreviewModal from "../AskMom/components/ImagePreviewModal";
import { H_PADDING } from "../AskMom/theme";
import TextMomFooterHomeButton from "./components/TextMomFooterHomeButton";
import TextMomHeader from "./components/TextMomHeader";

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
  card: "#FFFFFF",
  inputBg: "#F8FBFF",
};

const ADMIN_THREADS_POLL_MS = 5000;

type UiImage = {
  uri: string;
  name: string;
  type: string;
};

function formatThreadTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);

  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

function getSubline(thread: AdminSupportTextThreadSummary) {
  const snap = thread.support_identity_snapshot || {};
  return snap.email || snap.phone || "Support user";
}

function mergeMessagesById(
  incoming: AdminSupportTextMessage[]
): AdminSupportTextMessage[] {
  const map = new Map<number, AdminSupportTextMessage>();

  incoming.forEach((message) => {
    map.set(message.id, message);
  });

  return [...map.values()].sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();

    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}

export default function TextMomAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const FOOTER_MIN_HEIGHT = 56;
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  const flatListRef = useRef<FlatList<AdminSupportTextMessage>>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFetchingThreadsRef = useRef(false);
  const isFocusedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const selectedThreadIdRef = useRef<number | null>(null);

  const [threads, setThreads] = useState<AdminSupportTextThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedThread, setSelectedThread] =
    useState<AdminSupportTextThreadSummary | null>(null);
  const [threadMessages, setThreadMessages] = useState<AdminSupportTextMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pickedImages, setPickedImages] = useState<UiImage[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const unreadCount = useMemo(
    () => threads.filter((t) => t.support_unread).length,
    [threads]
  );

  const titleStyle = useMemo(
    () => [styles.threadTitle, isNarrow && styles.threadTitleNarrow],
    [isNarrow]
  );

  const sendDisabled = sending || (!draft.trim() && pickedImages.length === 0);
  const showingThread = !!selectedThread;

  const openPreview = useCallback((uri: string) => {
    setPreviewUri(uri);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewUri(null);
  }, []);

  const loadThreads = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (isFetchingThreadsRef.current) return;

      try {
        isFetchingThreadsRef.current = true;

        if (mode === "initial") setLoading(true);
        if (mode === "refresh") setRefreshing(true);
        if (mode !== "silent") setError(null);

        const rows = await fetchAdminSupportThreads();
        setThreads(rows);
        setError(null);

        if (selectedThreadIdRef.current) {
          const updatedSelected =
            rows.find((row) => row.id === selectedThreadIdRef.current) || null;

          if (updatedSelected) {
            setSelectedThread(updatedSelected);
          }
        }
      } catch (e: any) {
        if (mode !== "silent") {
          setError(e?.message || "Unable to load support threads.");
        }
      } finally {
        isFetchingThreadsRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  const loadSelectedThread = useCallback(async (threadId: number) => {
    try {
      setThreadLoading(true);
      setThreadError(null);

      const [threadRow, messageRows] = await Promise.all([
        fetchAdminSupportThread(threadId),
        fetchAdminSupportMessages(threadId),
      ]);

      setSelectedThread(threadRow);
      selectedThreadIdRef.current = threadRow.id;
      setThreadMessages(mergeMessagesById(messageRows));
    } catch (e: any) {
      setThreadError(e?.message || "Unable to load support thread.");
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const refreshSelectedThreadMessages = useCallback(async () => {
    const activeThreadId = selectedThreadIdRef.current;
    if (!activeThreadId) return;

    try {
      const [threadRow, messageRows] = await Promise.all([
        fetchAdminSupportThread(activeThreadId),
        fetchAdminSupportMessages(activeThreadId),
      ]);

      setSelectedThread(threadRow);
      setThreadMessages((prev) => mergeMessagesById([...prev, ...messageRows]));

      setThreads((prev) =>
        prev.map((row) => (row.id === threadRow.id ? threadRow : row))
      );
    } catch {
      // silent poll failure
    }
  }, []);

  const handleSelectThread = useCallback(
    async (threadId: number) => {
      setDraft("");
      setPickedImages([]);
      setThreadMessages([]);
      await loadSelectedThread(threadId);
    },
    [loadSelectedThread]
  );

  const handleBackToInbox = useCallback(() => {
    setSelectedThread(null);
    selectedThreadIdRef.current = null;
    setThreadMessages([]);
    setThreadError(null);
    setDraft("");
    setPickedImages([]);
  }, []);

  const pickImages = useCallback(async () => {
    if (pickedImages.length >= 4) {
      Alert.alert("Image limit", "Maximum of 4 images.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4 - pickedImages.length,
      quality: 0.82,
    });

    if (result.canceled) return;

    const nextImages: UiImage[] = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `support-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || "image/jpeg",
    }));

    setPickedImages((prev) => [...prev, ...nextImages].slice(0, 4));
  }, [pickedImages.length]);

  const handleSend = useCallback(async () => {
    const activeThreadId = selectedThreadIdRef.current;
    const trimmed = draft.trim();
    const imagesToSend = [...pickedImages];

    if (!activeThreadId || (!trimmed && imagesToSend.length === 0) || sending) {
      return;
    }

    try {
      setSending(true);
      setDraft("");
      setPickedImages([]);

      const created = await sendAdminSupportMessage(
        activeThreadId,
        trimmed,
        imagesToSend
      );

      setThreadMessages((prev) => mergeMessagesById([...prev, created]));

      await loadThreads("silent");
      await refreshSelectedThreadMessages();
    } catch (e: any) {
      Alert.alert("Send failed", e?.message || "Unable to send reply.");
    } finally {
      setSending(false);
    }
  }, [draft, pickedImages, sending, loadThreads, refreshSelectedThreadMessages]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    pollingIntervalRef.current = setInterval(() => {
      const appIsActive = appStateRef.current === "active";
      if (!isFocusedRef.current || !appIsActive) return;

      void loadThreads("silent");

      if (selectedThreadIdRef.current) {
        void refreshSelectedThreadMessages();
      }
    }, ADMIN_THREADS_POLL_MS);
  }, [loadThreads, refreshSelectedThreadMessages]);

  useEffect(() => {
    void loadThreads("initial");
  }, [loadThreads]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      void loadThreads("silent");

      if (selectedThreadIdRef.current) {
        void refreshSelectedThreadMessages();
      }

      startPolling();

      return () => {
        isFocusedRef.current = false;
        stopPolling();
      };
    }, [loadThreads, refreshSelectedThreadMessages, startPolling, stopPolling])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasBackgrounded =
        appStateRef.current === "inactive" || appStateRef.current === "background";

      appStateRef.current = nextAppState;

      if (nextAppState === "active" && isFocusedRef.current && wasBackgrounded) {
        void loadThreads("silent");

        if (selectedThreadIdRef.current) {
          void refreshSelectedThreadMessages();
        }

        startPolling();
      }

      if (nextAppState !== "active") {
        stopPolling();
      }
    });

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [loadThreads, refreshSelectedThreadMessages, startPolling, stopPolling]);

  useEffect(() => {
    if (!threadMessages.length) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    return () => clearTimeout(timer);
  }, [threadMessages]);

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
              {item.images.map((img, index) => (
                <Pressable
                  key={`${item.id}-${img.id}-${index}`}
                  onPress={() => openPreview(img.url)}
                  style={({ pressed }) => [
                    styles.messageImagePressable,
                    pressed && styles.imagePressed,
                  ]}
                >
                  <Image
                    source={{ uri: img.url }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                </Pressable>
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
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View
          style={[
            styles.screen,
            {
              paddingTop: 12,
              paddingBottom: 10,
              paddingHorizontal: H_PADDING,
            },
          ]}
        >
          <ImagePreviewModal
            open={previewOpen}
            uri={previewUri}
            onClose={closePreview}
          />

          {!showingThread ? (
            <>
              <TextMomHeader title="Text Support" />

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                  styles.content,
                  {
                    paddingBottom: footerTotalHeight + 12,
                    flexGrow: 1,
                  },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void loadThreads("refresh")}
                  />
                }
              >
                <View style={styles.adminHeroCard}>
                  <View style={styles.adminHeroIcon}>
                    <Ionicons
                      name="shield-checkmark"
                      size={28}
                      color={BRAND.blue}
                    />
                  </View>

                  <Text style={styles.adminHeroTitle}>Support Inbox</Text>
                  <Text style={styles.adminHeroBody}>
                    Open threads, unread replies, and active user conversations.
                  </Text>
                </View>

                <View style={styles.summaryCard}>
                  <View style={styles.summaryLeft}>
                    <Text style={styles.summaryTitle}>Open threads</Text>
                    <Text style={styles.summaryValue}>{threads.length}</Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryRight}>
                    <Text style={styles.summaryTitle}>Unread</Text>
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                    </View>
                  </View>
                </View>

                {loading ? (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color={BRAND.blue} />
                    <Text style={styles.loadingText}>Loading support threads…</Text>
                  </View>
                ) : error ? (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorTitle}>Couldn’t load inbox</Text>
                    <Text style={styles.errorBody}>{error}</Text>

                    <Pressable
                      onPress={() => void loadThreads("initial")}
                      style={({ pressed }) => [
                        styles.retryBtn,
                        pressed && styles.actionBtnPressed,
                      ]}
                    >
                      <Text style={styles.retryBtnText}>Try again</Text>
                    </Pressable>
                  </View>
                ) : threads.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons
                      name="mail-open-outline"
                      size={30}
                      color={BRAND.muted}
                    />
                    <Text style={styles.emptyTitle}>No open text threads</Text>
                    <Text style={styles.emptyBody}>
                      When users text support, their conversations will appear here.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.threadList}>
                    {threads.map((thread) => {
                      const unread = thread.support_unread;
                      const displayName = getDisplayName(thread);
                      const subline = getSubline(thread);

                      return (
                        <Pressable
                          key={`thread-${thread.id}`}
                          onPress={() => void handleSelectThread(thread.id)}
                          style={({ pressed }) => [
                            styles.threadCard,
                            unread && styles.threadCardUnread,
                            pressed && styles.actionBtnPressed,
                          ]}
                        >
                          <View style={styles.threadTopRow}>
                            <View style={styles.threadIdentityWrap}>
                              <Text style={styles.threadName}>{displayName}</Text>
                              <Text style={styles.threadSubline}>{subline}</Text>
                            </View>

                            <View style={styles.threadMetaWrap}>
                              {!!thread.last_message_at && (
                                <Text style={styles.threadTime}>
                                  {formatThreadTime(thread.last_message_at)}
                                </Text>
                              )}

                              {unread ? (
                                <View style={styles.threadUnreadPill}>
                                  <Text style={styles.threadUnreadPillText}>
                                    Unread
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View style={styles.threadBottomRow}>
                            <View style={styles.threadInfoRow}>
                              <Text style={styles.threadInfoLabel}>Status:</Text>
                              <Text style={styles.threadInfoValue}>
                                {thread.status || "open"}
                              </Text>
                            </View>

                            <View style={styles.threadInfoRow}>
                              <Text style={styles.threadInfoLabel}>Priority:</Text>
                              <Text style={styles.threadInfoValue}>
                                {thread.priority || "normal"}
                              </Text>
                            </View>

                            <View style={styles.threadInfoRow}>
                              <Text style={styles.threadInfoLabel}>Assigned:</Text>
                              <Text style={styles.threadInfoValue}>
                                {thread.assigned_agent_name || "Unassigned"}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <View style={styles.scamBadge}>
                  <Ionicons name="chatbubbles" size={44} color={BRAND.blue} />
                  <Text style={styles.scamBadgeText}>
                    Text Support{"\n"}Inbox
                  </Text>
                </View>
              </ScrollView>

              <TextMomFooterHomeButton
                onPress={() => router.replace("/(app)")}
                bottomInset={insets.bottom}
              />
            </>
          ) : (
            <>
              <View style={styles.threadHeaderWrap}>
                <Pressable
                  onPress={handleBackToInbox}
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

                  <Text style={titleStyle}>{getDisplayName(selectedThread)}</Text>

                  <Text style={styles.headerSubtitle}>
                    {selectedThread?.assigned_agent_name
                      ? `Assigned to ${selectedThread.assigned_agent_name}`
                      : "Support conversation"}
                  </Text>
                </View>
              </View>

              {threadLoading ? (
                <View style={styles.loadingWrapThread}>
                  <View style={styles.loadingOrb}>
                    <ActivityIndicator size="large" color={BRAND.blue} />
                  </View>
                  <Text style={styles.loadingTitle}>Opening thread…</Text>
                  <Text style={styles.loadingText}>
                    Getting the latest messages ready.
                  </Text>
                </View>
              ) : threadError ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>Couldn’t load thread</Text>
                  <Text style={styles.errorBody}>{threadError}</Text>

                  <Pressable
                    onPress={() => {
                      if (selectedThreadIdRef.current) {
                        void loadSelectedThread(selectedThreadIdRef.current);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.retryBtn,
                      pressed && styles.actionBtnPressed,
                    ]}
                  >
                    <Text style={styles.retryBtnText}>Try again</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <FlatList
                    ref={flatListRef}
                    data={threadMessages}
                    keyExtractor={(item) => `msg-${item.id}`}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messagesList}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 1 }}
                  />

                  {!!pickedImages.length && (
                    <View style={styles.pickedImagesCard}>
                      <View style={styles.pickedImagesHeader}>
                        <Text style={styles.pickedImagesTitle}>
                          Attachments ({pickedImages.length}/4)
                        </Text>
                      </View>

                      <View style={styles.pickedImagesRow}>
                        {pickedImages.map((img, idx) => (
                          <View
                            key={`${img.uri}-${idx}`}
                            style={styles.pickedImageWrap}
                          >
                            <Pressable
                              onPress={() => openPreview(img.uri)}
                              style={({ pressed }) => [
                                styles.pickedImagePressable,
                                pressed && styles.imagePressed,
                              ]}
                            >
                              <Image
                                source={{ uri: img.uri }}
                                style={styles.pickedImage}
                              />
                            </Pressable>

                            <Pressable
                              style={styles.removeImageBtn}
                              onPress={() =>
                                setPickedImages((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                            >
                              <Ionicons name="close" size={14} color="#FFF" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.composerOuter}>
                    <View style={styles.composerWrap}>
                      <Pressable
                        onPress={pickImages}
                        style={({ pressed }) => [
                          styles.attachBtn,
                          pressed && styles.attachBtnPressed,
                        ]}
                      >
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color={BRAND.blue}
                        />
                      </Pressable>

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
                        onPress={() => void handleSend()}
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

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
  },

  content: {
    paddingTop: 12,
    gap: 12,
  },

  adminHeroCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },

  adminHeroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.inputBg,
    borderWidth: 1,
    borderColor: BRAND.border,
    marginBottom: 10,
  },

  adminHeroTitle: {
    color: BRAND.text,
    fontSize: 18,
    fontWeight: "900",
    fontFamily: FONT.medium,
    marginBottom: 6,
    textAlign: "center",
  },

  adminHeroBody: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  summaryCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  summaryLeft: {
    flex: 1,
  },

  summaryRight: {
    flex: 1,
    alignItems: "flex-start",
  },

  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: BRAND.border,
    marginHorizontal: 12,
  },

  summaryTitle: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: FONT.regular,
    marginBottom: 6,
  },

  summaryValue: {
    color: BRAND.text,
    fontSize: 26,
    fontFamily: FONT.medium,
  },

  unreadBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  unreadBadgeText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  loadingCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
    gap: 10,
  },

  loadingWrapThread: {
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

  errorCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
  },

  errorTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: FONT.medium,
    marginBottom: 6,
  },

  errorBody: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
    marginBottom: 12,
  },

  retryBtn: {
    alignSelf: "flex-start",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: BRAND.blue,
  },

  retryBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: FONT.medium,
  },

  emptyCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },

  emptyTitle: {
    color: BRAND.text,
    fontSize: 16,
    fontFamily: FONT.medium,
    marginTop: 10,
    marginBottom: 6,
    textAlign: "center",
  },

  emptyBody: {
    color: BRAND.muted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
    textAlign: "center",
  },

  threadList: {
    gap: 10,
  },

  threadCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 14,
  },

  threadCardUnread: {
    borderColor: BRAND.blue,
    backgroundColor: BRAND.inputBg,
  },

  threadTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  threadIdentityWrap: {
    flex: 1,
  },

  threadName: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: FONT.medium,
    marginBottom: 2,
  },

  threadSubline: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  threadMetaWrap: {
    alignItems: "flex-end",
    gap: 6,
  },

  threadTime: {
    color: BRAND.muted,
    fontSize: 11,
    fontFamily: FONT.regular,
  },

  threadUnreadPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: BRAND.blue,
  },

  threadUnreadPillText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: FONT.medium,
  },

  threadBottomRow: {
    gap: 4,
  },

  threadInfoRow: {
    flexDirection: "row",
    gap: 6,
  },

  threadInfoLabel: {
    color: BRAND.muted,
    fontSize: 12,
    fontFamily: FONT.regular,
  },

  threadInfoValue: {
    color: BRAND.text,
    fontSize: 12,
    fontFamily: FONT.medium,
  },

  threadHeaderWrap: {
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

  threadTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 28,
    lineHeight: 32,
  },

  threadTitleNarrow: {
    fontSize: 24,
    lineHeight: 28,
  },

  headerSubtitle: {
    marginTop: 3,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
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

  messageImagePressable: {
    alignSelf: "flex-start",
    borderRadius: 12,
  },

  messageImage: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
  },

  imagePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  pickedImagesCard: {
    marginBottom: 10,
    paddingTop: 10,
  },

  pickedImagesHeader: {
    marginBottom: 8,
  },

  pickedImagesTitle: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  pickedImagesRow: {
    flexDirection: "row",
    gap: 10,
  },

  pickedImageWrap: {
    position: "relative",
  },

  pickedImagePressable: {
    borderRadius: 14,
  },

  pickedImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#E6EDF5",
  },

  removeImageBtn: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: BRAND.red,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
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

  attachBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  attachBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
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

  actionBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  scamBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 6,
    backgroundColor: BRAND.screenBg,
  },

  scamBadgeText: {
    fontSize: 20,
    color: BRAND.muted,
    fontFamily: FONT.medium,
    textAlign: "center",
    lineHeight: 22,
  },
});