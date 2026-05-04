// app/src/screens/TextMom/TextMomUserScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import type { Cable } from "@rails/actioncable";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { useAuth } from "../../auth/AuthProvider";
import { getJson, postJson } from "../../services/api/client";
import {
  fetchSupportTextThread,
  fetchSupportTextThreads,
  sendSupportTextMessage,
  type SupportTextThreadSummary,
} from "../../services/api/supportTextThreads";
import { buildCableConsumer } from "../../services/cable/createCable";
import { subscribeToSupportTextThread } from "../../services/cable/supportTextThreadSubscription";
import ImagePreviewModal from "../AskMom/components/ImagePreviewModal";
import DebugDropdown from "./components/DebugDropdown";
import HistoryDrawer from "./components/HistoryDrawer";

const SHOW_DEBUG_DROPDOWN = false;

// Turn this back to true only if you need the orange-bar debug panel again.
const SHOW_NEW_MESSAGE_BAR_DEBUG = false;

const FALLBACK_REFRESH_MS = 20 * 60 * 1000;

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
  orange: "#EA580C",
  orangeDark: "#9A3412",
  orangeSoft: "#FFF7ED",
  orangeBorder: "#FDBA74",
  bubbleMine: "#1D6FE9",
  bubbleMineText: "#FFFFFF",
  bubbleTheirs: "#FFFFFF",
  bubbleTheirsText: "#111827",
  bubbleSystemBg: "#EEF4FF",
  bubbleSystemBorder: "#C9DBFF",
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LAST_THREAD_DIVIDER_ID = -999999;
const LOCAL_WELCOME_ID = -1;
const NEW_SUPPORT_MESSAGE_NOTICE_ID = -888888;

const USER_LAST_SEEN_SUPPORT_MESSAGE_KEY_PREFIX =
  "text_mom_user_last_seen_support_message_id_v5_";

type UiImage = {
  uri: string;
  name: string;
  type: string;
};

type ThreadMode = "fresh" | "recent";

type SupportTextThread = {
  id: number;
  public_token?: string;
  status?: string;
  started_at?: string | null;
  last_message_at?: string | null;
  last_user_message_at?: string | null;
  last_support_message_at?: string | null;
  cooldown_until?: string | null;
  subject?: string | null;
  assigned_agent_name?: string | null;
  created_at?: string | null;
};

type SupportTextMessage = {
  id: number;
  direction: "outbound_to_support" | "inbound_from_support" | "system";
  status: string;
  body: string | null;
  created_at: string;
  intro_message?: boolean;
  author_agent_name?: string | null;
  visible_to_user?: boolean;
  images: Array<{
    id: number;
    url: string;
    filename: string;
    content_type: string;
    byte_size: number;
  }>;
};

type SupportTextRenderableMessage = SupportTextMessage & {
  dividerLabel?: string;
  noticeKind?: "new_support_messages";
  noticeCount?: number;
};

type NewSupportNoticeState = {
  anchorMessageId: number;
  count: number;
} | null;

type CableSubscription = {
  unsubscribe: () => void;
};

type NewMessageDebugState = {
  threadId: number | null;
  savedLastSeenId: number;
  incomingIds: number[];
  newIds: number[];
  noticeAnchorId: number | null;
  noticeCount: number;
  displayIds: number[];
  lastEvent: string;
};

function formatMetaTime(iso?: string | null) {
  if (!iso) return "";

  const d = new Date(iso);

  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getThreadSortTime(
  thread?:
    | {
      last_message_at?: string | null;
      started_at?: string | null;
      created_at?: string | null;
    }
    | null
) {
  const raw =
    thread?.last_message_at || thread?.started_at || thread?.created_at || null;

  if (!raw) return 0;

  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isThreadRecent(
  thread?:
    | {
      last_message_at?: string | null;
      started_at?: string | null;
      created_at?: string | null;
    }
    | null
) {
  const ts = getThreadSortTime(thread);
  if (!ts) return false;
  return Date.now() - ts <= ONE_DAY_MS;
}

function buildLastThreadDivider(
  label = "Your last conversation"
): SupportTextRenderableMessage {
  return {
    id: LAST_THREAD_DIVIDER_ID,
    direction: "system",
    status: "sent",
    body: null,
    created_at: new Date().toISOString(),
    intro_message: false,
    author_agent_name: "Mom's Computer",
    images: [],
    dividerLabel: label,
  };
}

function getUserLastSeenSupportMessageKey(threadId: number) {
  return `${USER_LAST_SEEN_SUPPORT_MESSAGE_KEY_PREFIX}${threadId}`;
}

function buildNewSupportNotice(count: number): SupportTextRenderableMessage {
  return {
    id: NEW_SUPPORT_MESSAGE_NOTICE_ID,
    direction: "system",
    status: "sent",
    body: null,
    created_at: new Date().toISOString(),
    intro_message: false,
    author_agent_name: "Mom's Computer",
    images: [],
    noticeKind: "new_support_messages",
    noticeCount: count,
  };
}

function getIncomingSupportMessages(rows: SupportTextRenderableMessage[]) {
  return rows
    .filter(
      (m) =>
        m.id > 0 &&
        m.direction === "inbound_from_support" &&
        !m.noticeKind
    )
    .sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();

      if (aTime !== bTime) return aTime - bTime;
      return a.id - b.id;
    });
}

function insertNewSupportNoticeIntoMessages(
  rows: SupportTextRenderableMessage[],
  notice: NewSupportNoticeState
) {
  if (!notice || !notice.anchorMessageId || notice.count <= 0) {
    return rows.filter((m) => m.id !== NEW_SUPPORT_MESSAGE_NOTICE_ID);
  }

  const cleanedRows = rows.filter((m) => m.id !== NEW_SUPPORT_MESSAGE_NOTICE_ID);
  const anchorIndex = cleanedRows.findIndex((m) => m.id === notice.anchorMessageId);

  if (anchorIndex < 0) return cleanedRows;

  const noticeRow = buildNewSupportNotice(notice.count);

  return [
    ...cleanedRows.slice(0, anchorIndex),
    noticeRow,
    ...cleanedRows.slice(anchorIndex),
  ];
}

export default function TextMomUserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const deepLinkThreadIdRaw = Array.isArray(params.threadId)
    ? params.threadId[0]
    : params.threadId;
  const deepLinkThreadId = deepLinkThreadIdRaw ? Number(deepLinkThreadIdRaw) : null;

  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const auth = useAuth() as any;
  const user = auth?.user;

  const flatListRef = useRef<FlatList<SupportTextRenderableMessage>>(null);
  const threadIdRef = useRef<number | null>(null);
  const threadRef = useRef<SupportTextThread | null>(null);
  const messagesRef = useRef<SupportTextRenderableMessage[]>([]);
  const modeRef = useRef<ThreadMode>("fresh");
  const introEligibleRef = useRef(false);
  const bootstrapRunIdRef = useRef(0);
  const sentInCurrentSessionRef = useRef(false);
  const cableRef = useRef<Cable | null>(null);
  const threadSubscriptionRef = useRef<CableSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const showLastThreadDividerRef = useRef(false);
  const hasBootstrappedRef = useRef(false);
  const subscriptionRunIdRef = useRef(0);
  const refreshAfterSocketTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const handledDeepLinkThreadIdRef = useRef<number | null>(null);
  const deepLinkInProgressRef = useRef(false);
  const newSupportNoticeRef = useRef<NewSupportNoticeState>(null);
  const scrollTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [threads, setThreads] = useState<SupportTextThreadSummary[]>([]);

  const [isBooting, setIsBooting] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [thread, setThread] = useState<SupportTextThread | null>(null);
  const [messages, setMessages] = useState<SupportTextRenderableMessage[]>([]);
  const [newSupportNotice, setNewSupportNotice] =
    useState<NewSupportNoticeState>(null);

  const [newMessageDebug, setNewMessageDebug] = useState<NewMessageDebugState>({
    threadId: null,
    savedLastSeenId: 0,
    incomingIds: [],
    newIds: [],
    noticeAnchorId: null,
    noticeCount: 0,
    displayIds: [],
    lastEvent: "not checked yet",
  });

  const [draft, setDraft] = useState("");
  const [pickedImages, setPickedImages] = useState<UiImage[]>([]);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [showLastThreadDivider, setShowLastThreadDivider] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    title: string;
    body: string;
    tone: "recent" | "fresh";
  } | null>(null);

  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    newSupportNoticeRef.current = newSupportNotice;
  }, [newSupportNotice]);

  const titleStyle = useMemo(
    () => [styles.title, isNarrow && styles.titleNarrow],
    [isNarrow]
  );

  const sendDisabled = isSending || (!draft.trim() && pickedImages.length === 0);

  const displayMessages = useMemo(
    () => insertNewSupportNoticeIntoMessages(messages, newSupportNotice),
    [messages, newSupportNotice]
  );

  const clearScrollTimers = useCallback(() => {
    scrollTimersRef.current.forEach((timer) => clearTimeout(timer));
    scrollTimersRef.current = [];
  }, []);

  const scrollToBottom = useCallback(
    (animated = true) => {
      clearScrollTimers();

      const delays = [40, 140, 320, 650];

      delays.forEach((delay) => {
        const timer = setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated });
        }, delay);

        scrollTimersRef.current.push(timer);
      });
    },
    [clearScrollTimers]
  );

  useEffect(() => {
    setNewMessageDebug((prev) => ({
      ...prev,
      displayIds: displayMessages.map((message) => message.id),
      noticeAnchorId: newSupportNotice?.anchorMessageId || null,
      noticeCount: newSupportNotice?.count || 0,
    }));

    console.log("[TextMomUser] displayMessages updated", {
      displayIds: displayMessages.map((message) => message.id),
      notice: newSupportNotice,
    });

    if (displayMessages.length > 0) {
      scrollToBottom(true);
    }
  }, [displayMessages, newSupportNotice, scrollToBottom]);

  useEffect(() => {
    return () => {
      clearScrollTimers();
    };
  }, [clearScrollTimers]);

  const openPreview = useCallback((uri: string) => {
    setPreviewUri(uri);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    setPreviewUri(null);
  }, []);

  const setNoticeAndMarkSeenForNextVisit = useCallback(
    async (
      threadId: number,
      anchorMessageId: number,
      count: number,
      latestId: number
    ) => {
      const nextNotice = {
        anchorMessageId,
        count,
      };

      console.log("[TextMomUser] SETTING ORANGE BAR", {
        threadId,
        nextNotice,
        latestId,
      });

      setNewSupportNotice(nextNotice);
      newSupportNoticeRef.current = nextNotice;

      setNewMessageDebug((prev) => ({
        ...prev,
        threadId,
        noticeAnchorId: nextNotice.anchorMessageId,
        noticeCount: nextNotice.count,
        lastEvent: `orange bar set above message ${anchorMessageId}; count ${count}`,
      }));

      scrollToBottom(true);

      try {
        await SecureStore.setItemAsync(
          getUserLastSeenSupportMessageKey(threadId),
          String(latestId)
        );
      } catch (error) {
        console.log("[TextMomUser] failed saving seen support id", error);

        setNewMessageDebug((prev) => ({
          ...prev,
          lastEvent: `failed saving seen id: ${String(error)}`,
        }));
      }
    },
    [scrollToBottom]
  );

  const evaluateNewSupportNotice = useCallback(
    async (threadId: number, rows: SupportTextRenderableMessage[]) => {
      try {
        const incomingSupportMessages = getIncomingSupportMessages(rows);
        const incomingIds = incomingSupportMessages.map((message) => message.id);

        if (!incomingSupportMessages.length) {
          console.log("[TextMomUser] no incoming support messages found", {
            threadId,
            rowDirections: rows.map((message) => ({
              id: message.id,
              direction: message.direction,
              noticeKind: message.noticeKind,
            })),
          });

          setNewMessageDebug((prev) => ({
            ...prev,
            threadId,
            savedLastSeenId: 0,
            incomingIds: [],
            newIds: [],
            noticeAnchorId: null,
            noticeCount: 0,
            lastEvent: "no inbound_from_support messages found",
          }));

          setNewSupportNotice(null);
          newSupportNoticeRef.current = null;
          return;
        }

        const latestIncomingMessage =
          incomingSupportMessages[incomingSupportMessages.length - 1];

        const existingNotice = newSupportNoticeRef.current;

        if (existingNotice?.anchorMessageId) {
          const messagesSinceAnchor = incomingSupportMessages.filter(
            (message) => message.id >= existingNotice.anchorMessageId
          );

          const nextNotice = {
            anchorMessageId: existingNotice.anchorMessageId,
            count: Math.max(messagesSinceAnchor.length, existingNotice.count),
          };

          console.log("[TextMomUser] keeping existing orange bar alive", {
            threadId,
            existingNotice,
            nextNotice,
            incomingIds,
          });

          setNewSupportNotice(nextNotice);
          newSupportNoticeRef.current = nextNotice;

          setNewMessageDebug((prev) => ({
            ...prev,
            threadId,
            incomingIds,
            newIds: messagesSinceAnchor.map((message) => message.id),
            noticeAnchorId: nextNotice.anchorMessageId,
            noticeCount: nextNotice.count,
            lastEvent: "kept existing orange bar alive during refresh",
          }));

          scrollToBottom(true);

          await SecureStore.setItemAsync(
            getUserLastSeenSupportMessageKey(threadId),
            String(latestIncomingMessage.id)
          );

          return;
        }

        const key = getUserLastSeenSupportMessageKey(threadId);
        const rawLastSeen = await SecureStore.getItemAsync(key);
        const parsedLastSeenId = Number(rawLastSeen || 0);
        const safeLastSeenId = Number.isFinite(parsedLastSeenId)
          ? parsedLastSeenId
          : 0;

        const newMessages = incomingSupportMessages.filter(
          (message) => message.id > safeLastSeenId
        );

        const newIds = newMessages.map((message) => message.id);

        console.log("[TextMomUser] new support notice check", {
          threadId,
          storageKey: key,
          rawLastSeen,
          safeLastSeenId,
          incomingIds,
          newIds,
          rowDirections: rows.map((message) => ({
            id: message.id,
            direction: message.direction,
            noticeKind: message.noticeKind,
          })),
        });

        setNewMessageDebug((prev) => ({
          ...prev,
          threadId,
          savedLastSeenId: safeLastSeenId,
          incomingIds,
          newIds,
          noticeAnchorId: newMessages[0]?.id || null,
          noticeCount: newMessages.length,
          lastEvent: newMessages.length
            ? `found ${newMessages.length} new support message(s)`
            : "no new support messages after saved last-seen id",
        }));

        if (!newMessages.length) {
          setNewSupportNotice(null);
          newSupportNoticeRef.current = null;
          return;
        }

        await setNoticeAndMarkSeenForNextVisit(
          threadId,
          newMessages[0].id,
          newMessages.length,
          latestIncomingMessage.id
        );
      } catch (error) {
        console.log("[TextMomUser] new support notice check failed", error);

        setNewMessageDebug((prev) => ({
          ...prev,
          lastEvent: `error checking orange bar: ${String(error)}`,
        }));

        setNewSupportNotice(null);
        newSupportNoticeRef.current = null;
      }
    },
    [scrollToBottom, setNoticeAndMarkSeenForNextVisit]
  );

  const forceOrangeBarForDebug = useCallback(async () => {
    const activeThreadId = threadIdRef.current;
    const incomingSupportMessages = getIncomingSupportMessages(messagesRef.current);

    if (!activeThreadId) {
      Alert.alert("No thread", "No active thread ID found yet.");
      return;
    }

    if (!incomingSupportMessages.length) {
      Alert.alert(
        "No support messages",
        "No inbound_from_support messages found."
      );
      return;
    }

    const latest = incomingSupportMessages[incomingSupportMessages.length - 1];

    await setNoticeAndMarkSeenForNextVisit(
      activeThreadId,
      latest.id,
      1,
      latest.id
    );
  }, [setNoticeAndMarkSeenForNextVisit]);

  useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    showLastThreadDividerRef.current = showLastThreadDivider;
  }, [showLastThreadDivider]);

  useEffect(() => {
    return () => {
      if (refreshAfterSocketTimerRef.current) {
        clearTimeout(refreshAfterSocketTimerRef.current);
        refreshAfterSocketTimerRef.current = null;
      }
    };
  }, []);

  const buildLocalWelcomeMessage = (): SupportTextRenderableMessage => {
    const firstName =
      user?.first_name ||
      user?.firstName ||
      user?.name?.split?.(" ")?.[0] ||
      "there";

    return {
      id: LOCAL_WELCOME_ID,
      direction: "system",
      status: "sent",
      body: `Hi ${firstName} — send a message here and Mom's Computer support will reply in this thread. You can attach screenshots too if that helps explain the issue.`,
      created_at: new Date().toISOString(),
      intro_message: true,
      author_agent_name: "Mom's Computer",
      images: [],
    };
  };

  const hasRealMessages = (rows: SupportTextRenderableMessage[]) =>
    rows.some(
      (m) =>
        m.id !== LOCAL_WELCOME_ID &&
        m.id !== LAST_THREAD_DIVIDER_ID &&
        m.id !== NEW_SUPPORT_MESSAGE_NOTICE_ID
    );

  const getLiveRecentUiCopy = useCallback((threadRow?: SupportTextThread | null) => {
    const lastSupportAt = threadRow?.last_support_message_at
      ? new Date(threadRow.last_support_message_at).getTime()
      : 0;
    const lastUserAt = threadRow?.last_user_message_at
      ? new Date(threadRow.last_user_message_at).getTime()
      : 0;

    const userMostRecent =
      sentInCurrentSessionRef.current ||
      (!!lastUserAt && (!lastSupportAt || lastUserAt >= lastSupportAt));

    if (userMostRecent) {
      return {
        title: "Message sent",
        body: "Mom's Computer has your message. You can add more details here while you wait for a reply.",
        dividerLabel: "Current support thread",
      };
    }

    return {
      title: "Recent conversation found",
      body: "We reopened your most recent support thread so you can keep going where you left off.",
      dividerLabel: "Your last conversation",
    };
  }, []);

  const applyMessages = useCallback(
    (
      incomingMessages: SupportTextMessage[],
      options?: {
        allowFallback?: boolean;
        includeLastThreadDivider?: boolean;
        preserveExistingIfEmpty?: boolean;
        evaluateNoticeForThreadId?: number;
      }
    ) => {
      const backendVisibleMessages = incomingMessages || [];
      const allowFallback = options?.allowFallback ?? false;
      const includeLastThreadDivider = options?.includeLastThreadDivider ?? false;
      const preserveExistingIfEmpty = options?.preserveExistingIfEmpty ?? false;
      const evaluateNoticeForThreadId = options?.evaluateNoticeForThreadId;

      const finalizeMessages = (nextRows: SupportTextRenderableMessage[]) => {
        console.log("[TextMomUser] applyMessages finalize", {
          evaluateNoticeForThreadId,
          ids: nextRows.map((message) => message.id),
          directions: nextRows.map((message) => ({
            id: message.id,
            direction: message.direction,
            noticeKind: message.noticeKind,
          })),
        });

        setMessages(nextRows);

        if (evaluateNoticeForThreadId) {
          void evaluateNewSupportNotice(evaluateNoticeForThreadId, nextRows);
        }

        scrollToBottom(true);
      };

      if (backendVisibleMessages.length > 0) {
        const dividerLabel = includeLastThreadDivider
          ? getLiveRecentUiCopy(threadRef.current).dividerLabel
          : undefined;

        const next: SupportTextRenderableMessage[] = includeLastThreadDivider
          ? [buildLastThreadDivider(dividerLabel), ...backendVisibleMessages]
          : [...backendVisibleMessages];

        finalizeMessages(next);
        setShowLastThreadDivider(includeLastThreadDivider);
        return;
      }

      if (preserveExistingIfEmpty) {
        setMessages((prev) => {
          if (hasRealMessages(prev)) {
            if (evaluateNoticeForThreadId) {
              void evaluateNewSupportNotice(evaluateNoticeForThreadId, prev);
            }

            scrollToBottom(true);
            return prev;
          }

          if (!allowFallback || !introEligibleRef.current) {
            if (evaluateNoticeForThreadId) {
              void evaluateNewSupportNotice(evaluateNoticeForThreadId, []);
            }

            return [];
          }

          const fallback = [buildLocalWelcomeMessage()];

          if (evaluateNoticeForThreadId) {
            void evaluateNewSupportNotice(evaluateNoticeForThreadId, fallback);
          }

          scrollToBottom(true);
          return fallback;
        });

        setShowLastThreadDivider(false);
        return;
      }

      if (!allowFallback || !introEligibleRef.current) {
        finalizeMessages([]);
        setShowLastThreadDivider(includeLastThreadDivider);
        return;
      }

      const fallback = [buildLocalWelcomeMessage()];
      finalizeMessages(fallback);
      setShowLastThreadDivider(false);
    },
    [evaluateNewSupportNotice, getLiveRecentUiCopy, scrollToBottom]
  );

  const refreshMessages = useCallback(
    async (silent = true, explicitThreadId?: number) => {
      try {
        const token = await SecureStore.getItemAsync("auth_token");
        if (!token) return;

        const threadId = explicitThreadId || threadIdRef.current;
        if (!threadId) return;

        console.log("[TextMomUser] refreshMessages starting", { threadId, silent });

        const path = `/v1/support_text_messages?thread_id=${threadId}`;
        const response = await getJson(path, token);

        console.log("[TextMomUser] refreshMessages response", {
          ok: response?.ok,
          threadId,
          count: response?.json?.messages?.length,
          messages: response?.json?.messages?.map?.((message: SupportTextMessage) => ({
            id: message.id,
            direction: message.direction,
            body: message.body,
          })),
        });

        if (!response?.ok) return;

        const nextMessages = response.json?.messages || [];
        const includeDivider =
          modeRef.current === "recent" || showLastThreadDividerRef.current;
        const currentThread = threadRef.current;
        const existingRows = messagesRef.current;
        const hasExistingRealMessages = hasRealMessages(existingRows);

        if (modeRef.current === "fresh" && !isThreadRecent(currentThread)) {
          if (!hasExistingRealMessages) {
            introEligibleRef.current = true;
            applyMessages([], {
              allowFallback: true,
              includeLastThreadDivider: false,
              preserveExistingIfEmpty: true,
              evaluateNoticeForThreadId: threadId,
            });
          }
          return;
        }

        if ((!nextMessages || nextMessages.length === 0) && hasExistingRealMessages) {
          scrollToBottom(true);
          return;
        }

        applyMessages(nextMessages, {
          allowFallback: modeRef.current === "fresh",
          includeLastThreadDivider: includeDivider,
          preserveExistingIfEmpty: true,
          evaluateNoticeForThreadId: threadId,
        });
      } catch (error) {
        console.log("[TextMomUser] refreshMessages failed", error);

        if (!silent) {
          setLastMessage("Unable to refresh messages right now.");
        }
      }
    },
    [applyMessages, scrollToBottom]
  );

  const refreshThreadSafely = useCallback(async () => {
    try {
      await refreshMessages(true);
    } catch (error) {
      console.warn("User thread fallback refresh failed", error);
    }
  }, [refreshMessages]);

  const clearThreadSubscription = useCallback(() => {
    subscriptionRunIdRef.current += 1;

    if (threadSubscriptionRef.current) {
      try {
        threadSubscriptionRef.current.unsubscribe();
      } catch (error) {
        console.log("[TextMomUser] thread unsubscribe failed", error);
      } finally {
        threadSubscriptionRef.current = null;
      }
    }
  }, []);

  const appendLiveMessage = useCallback(
    (
      incomingMessage: SupportTextMessage,
      incomingThread?: SupportTextThread | null
    ) => {
      if (incomingThread) {
        setThread(incomingThread);
        threadRef.current = incomingThread;
      }

      introEligibleRef.current = false;

      setMessages((prev) => {
        const cleaned = prev.filter(
          (m) =>
            m.id !== LOCAL_WELCOME_ID &&
            m.id !== LAST_THREAD_DIVIDER_ID &&
            m.id !== NEW_SUPPORT_MESSAGE_NOTICE_ID
        );

        const existingIndex = cleaned.findIndex((m) => m.id === incomingMessage.id);

        const normalizedIncoming: SupportTextRenderableMessage = {
          ...incomingMessage,
          images: Array.isArray(incomingMessage.images) ? incomingMessage.images : [],
        };

        const next =
          existingIndex >= 0
            ? cleaned.map((m) =>
              m.id === incomingMessage.id ? { ...m, ...normalizedIncoming } : m
            )
            : [...cleaned, normalizedIncoming];

        const sorted = next.sort((a, b) => {
          const aTime = new Date(a.created_at).getTime();
          const bTime = new Date(b.created_at).getTime();

          if (aTime !== bTime) return aTime - bTime;
          return a.id - b.id;
        });

        console.log("[TextMomUser] appendLiveMessage sorted", {
          incomingId: incomingMessage.id,
          incomingDirection: incomingMessage.direction,
          sortedIds: sorted.map((message) => message.id),
          sortedDirections: sorted.map((message) => ({
            id: message.id,
            direction: message.direction,
          })),
        });

        if (
          incomingMessage.direction === "inbound_from_support" &&
          threadRef.current?.id
        ) {
          const existingNotice = newSupportNoticeRef.current;
          const activeThreadId = threadRef.current.id;

          if (existingNotice?.anchorMessageId) {
            const incomingSupportMessages = getIncomingSupportMessages(sorted);

            const messagesSinceAnchor = incomingSupportMessages.filter(
              (message) => message.id >= existingNotice.anchorMessageId
            );

            void setNoticeAndMarkSeenForNextVisit(
              activeThreadId,
              existingNotice.anchorMessageId,
              Math.max(messagesSinceAnchor.length, existingNotice.count),
              incomingMessage.id
            );
          } else {
            void setNoticeAndMarkSeenForNextVisit(
              activeThreadId,
              incomingMessage.id,
              1,
              incomingMessage.id
            );
          }
        }

        return sorted;
      });

      setShowLastThreadDivider(false);
      scrollToBottom(true);
    },
    [scrollToBottom, setNoticeAndMarkSeenForNextVisit]
  );

  const scheduleRefreshForIncomingSupportMessage = useCallback(
    (threadId?: number | null) => {
      if (!threadId) return;

      if (refreshAfterSocketTimerRef.current) {
        clearTimeout(refreshAfterSocketTimerRef.current);
      }

      console.log("[TextMomUser] scheduling refresh for incoming support message", {
        threadId,
      });

      refreshAfterSocketTimerRef.current = setTimeout(() => {
        console.log("[TextMomUser] executing scheduled refresh", { threadId });
        void refreshMessages(true, threadId);
      }, 500);
    },
    [refreshMessages]
  );

  const subscribeToActiveThread = useCallback(
    async (activeThreadId?: number | null) => {
      const threadId = activeThreadId || threadIdRef.current;
      if (!threadId) return;

      const myRunId = ++subscriptionRunIdRef.current;

      try {
        if (!cableRef.current) {
          cableRef.current = await buildCableConsumer();
        }

        if (subscriptionRunIdRef.current !== myRunId) return;

        if (threadSubscriptionRef.current) {
          try {
            threadSubscriptionRef.current.unsubscribe();
          } catch (error) {
            console.log("[TextMomUser] thread unsubscribe failed", error);
          } finally {
            threadSubscriptionRef.current = null;
          }
        }

        if (subscriptionRunIdRef.current !== myRunId) return;

        threadSubscriptionRef.current = subscribeToSupportTextThread({
          consumer: cableRef.current,
          threadId,
          onMessageCreated: ({ message, thread }) => {
            console.log("[TextMomUser] socket message received", {
              id: message?.id,
              direction: message?.direction,
              body: message?.body,
              imageCount: Array.isArray(message?.images)
                ? message.images.length
                : "missing",
            });

            appendLiveMessage(message, thread);

            const isIncomingSupportMessage =
              message?.direction === "inbound_from_support";

            if (isIncomingSupportMessage) {
              scheduleRefreshForIncomingSupportMessage(thread?.id || threadId);
            }
          },
          onConnected: () => {
            console.log("[TextMomUser] thread subscription connected", threadId);
            void refreshThreadSafely();
          },
          onDisconnected: () => {
            console.log("[TextMomUser] thread subscription disconnected", threadId);
          },
          onError: (error) => {
            console.log("[TextMomUser] thread subscription error", error);
          },
        });
      } catch (error) {
        if (subscriptionRunIdRef.current === myRunId) {
          console.log("[TextMomUser] subscribeToActiveThread failed", error);
        }
      }
    },
    [appendLiveMessage, refreshThreadSafely, scheduleRefreshForIncomingSupportMessage]
  );

  const bootstrap = useCallback(async () => {
    const runId = ++bootstrapRunIdRef.current;

    try {
      setIsBooting(true);
      setLastMessage(null);
      introEligibleRef.current = false;
      setMessages([]);
      setNewSupportNotice(null);
      newSupportNoticeRef.current = null;
      setShowLastThreadDivider(false);
      setStatusBanner(null);
      modeRef.current = "fresh";
      sentInCurrentSessionRef.current = false;
      setThread(null);
      threadRef.current = null;
      threadIdRef.current = null;
      clearThreadSubscription();

      setNewMessageDebug({
        threadId: null,
        savedLastSeenId: 0,
        incomingIds: [],
        newIds: [],
        noticeAnchorId: null,
        noticeCount: 0,
        displayIds: [],
        lastEvent: "bootstrap started",
      });

      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert("Not signed in", "Please sign in again.");
        return;
      }

      let rows: SupportTextThreadSummary[] = [];

      try {
        rows = await fetchSupportTextThreads();
        if (bootstrapRunIdRef.current !== runId) return;
        setThreads(rows);
      } catch (e) {
        console.log("PRELOAD SUPPORT TEXT THREADS FAILED", e);
      }

      const mostRecentThread =
        rows && rows.length
          ? [...rows].sort(
            (a, b) => getThreadSortTime(b as any) - getThreadSortTime(a as any)
          )[0]
          : null;

      if (mostRecentThread && isThreadRecent(mostRecentThread as any)) {
        modeRef.current = "recent";
        introEligibleRef.current = false;

        const detail = await fetchSupportTextThread(mostRecentThread.id);
        if (bootstrapRunIdRef.current !== runId) return;

        setThread(detail.thread as SupportTextThread);
        threadRef.current = detail.thread as SupportTextThread;
        threadIdRef.current = detail.thread.id;

        const nextMessages = (detail.messages || []).filter(
          (m) => (m as any).visible_to_user !== false
        ) as SupportTextMessage[];

        console.log("[TextMomUser] bootstrap recent thread detail", {
          threadId: detail.thread.id,
          messages: nextMessages.map((message) => ({
            id: message.id,
            direction: message.direction,
            body: message.body,
          })),
        });

        if (nextMessages.length > 0) {
          applyMessages(nextMessages, {
            allowFallback: false,
            includeLastThreadDivider: true,
            evaluateNoticeForThreadId: detail.thread.id,
          });

          const recentCopy = getLiveRecentUiCopy(detail.thread as SupportTextThread);

          setStatusBanner({
            title: recentCopy.title,
            body: recentCopy.body,
            tone: "recent",
          });

          await subscribeToActiveThread(detail.thread.id);
          scrollToBottom(false);
          return;
        }

        modeRef.current = "fresh";
        setThread(null);
        threadRef.current = null;
        threadIdRef.current = null;
        setNewSupportNotice(null);
        newSupportNoticeRef.current = null;
        introEligibleRef.current = true;
        setStatusBanner(null);
        clearThreadSubscription();

        applyMessages([], {
          allowFallback: true,
          includeLastThreadDivider: false,
        });

        return;
      }

      modeRef.current = "fresh";
      introEligibleRef.current = true;
      clearThreadSubscription();

      applyMessages([], {
        allowFallback: true,
        includeLastThreadDivider: false,
      });
    } catch (e: any) {
      const msg = e?.message || "Unable to open Text Mom.";
      setLastMessage(msg);
      Alert.alert("Error", msg);
    } finally {
      if (bootstrapRunIdRef.current === runId) {
        setIsBooting(false);
      }
    }
  }, [
    applyMessages,
    clearThreadSubscription,
    getLiveRecentUiCopy,
    scrollToBottom,
    subscribeToActiveThread,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!hasBootstrappedRef.current) {
        hasBootstrappedRef.current = true;
        void bootstrap();
      } else {
        void refreshThreadSafely();
      }

      return undefined;
    }, [bootstrap, refreshThreadSafely])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void refreshThreadSafely();
    }, FALLBACK_REFRESH_MS);

    return () => clearInterval(interval);
  }, [refreshThreadSafely]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const wasBackgrounded =
          appStateRef.current === "inactive" || appStateRef.current === "background";

        appStateRef.current = nextState;

        if (nextState === "active" && wasBackgrounded) {
          void refreshThreadSafely();
        }
      }
    );

    return () => subscription.remove();
  }, [refreshThreadSafely]);

  useEffect(() => {
    return () => {
      clearThreadSubscription();
      clearScrollTimers();

      if (refreshAfterSocketTimerRef.current) {
        clearTimeout(refreshAfterSocketTimerRef.current);
        refreshAfterSocketTimerRef.current = null;
      }

      if (cableRef.current) {
        try {
          cableRef.current.disconnect();
        } catch (error) {
          console.log("[TextMomUser] cable disconnect failed", error);
        } finally {
          cableRef.current = null;
        }
      }
    };
  }, [clearScrollTimers, clearThreadSubscription]);

  const handleSelectThread = useCallback(
    async (threadId: number) => {
      try {
        setDrawerOpen(false);
        setIsBooting(true);
        setLastMessage(null);
        setMessages([]);
        setNewSupportNotice(null);
        newSupportNoticeRef.current = null;
        setShowLastThreadDivider(false);
        modeRef.current = "recent";
        introEligibleRef.current = false;
        sentInCurrentSessionRef.current = false;

        setNewMessageDebug({
          threadId,
          savedLastSeenId: 0,
          incomingIds: [],
          newIds: [],
          noticeAnchorId: null,
          noticeCount: 0,
          displayIds: [],
          lastEvent: "manual thread selected",
        });

        clearThreadSubscription();

        const detail = await fetchSupportTextThread(threadId);

        setThread(detail.thread as SupportTextThread);
        threadRef.current = detail.thread as SupportTextThread;
        threadIdRef.current = detail.thread.id;

        const nextMessages = (detail.messages || []).filter(
          (m) => (m as any).visible_to_user !== false
        ) as SupportTextMessage[];

        console.log("[TextMomUser] selected thread detail", {
          threadId: detail.thread.id,
          messages: nextMessages.map((message) => ({
            id: message.id,
            direction: message.direction,
            body: message.body,
          })),
        });

        applyMessages(nextMessages, {
          allowFallback: false,
          includeLastThreadDivider: true,
          evaluateNoticeForThreadId: detail.thread.id,
        });

        const recentCopy = getLiveRecentUiCopy(detail.thread as SupportTextThread);

        setStatusBanner({
          title: recentCopy.title,
          body: recentCopy.body,
          tone: "recent",
        });

        setDraft("");
        setPickedImages([]);

        await subscribeToActiveThread(detail.thread.id);
        scrollToBottom(false);
      } catch (e: any) {
        Alert.alert(
          "Couldn’t load that thread",
          e?.message ? String(e.message) : "Please try again."
        );
      } finally {
        setIsBooting(false);
      }
    },
    [
      applyMessages,
      clearThreadSubscription,
      getLiveRecentUiCopy,
      scrollToBottom,
      subscribeToActiveThread,
    ]
  );

  useEffect(() => {
    if (!deepLinkThreadId || !Number.isFinite(deepLinkThreadId)) return;
    if (isBooting) return;
    if (deepLinkInProgressRef.current) return;
    if (handledDeepLinkThreadIdRef.current === deepLinkThreadId) return;

    if (threadIdRef.current === deepLinkThreadId) {
      handledDeepLinkThreadIdRef.current = deepLinkThreadId;
      return;
    }

    deepLinkInProgressRef.current = true;

    (async () => {
      try {
        console.log("[TextMomUser] handling deep link threadId:", deepLinkThreadId);
        await handleSelectThread(deepLinkThreadId);
        handledDeepLinkThreadIdRef.current = deepLinkThreadId;
      } catch (error) {
        console.log("[TextMomUser] deep link open failed", error);
      } finally {
        deepLinkInProgressRef.current = false;
      }
    })();
  }, [deepLinkThreadId, handleSelectThread, isBooting]);

  const addPickedImages = (nextImages: UiImage[]) => {
    setPickedImages((prev) => {
      const merged = [...prev];

      for (const img of nextImages) {
        if (merged.some((m) => m.uri === img.uri)) continue;
        if (merged.length >= 4) break;
        merged.push(img);
      }

      return merged.slice(0, 4);
    });
  };

  const openCamera = async () => {
    try {
      if (pickedImages.length >= 4) {
        Alert.alert("Image limit", "Maximum of 4 images.");
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.82,
        cameraType: ImagePicker.CameraType.back,
      });

      if (result.canceled) return;

      const nextImages: UiImage[] = result.assets.map((asset, index) => ({
        uri: asset.uri,
        name: asset.fileName || `textmom-camera-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));

      addPickedImages(nextImages);
    } catch (e) {
      console.log("TEXT MOM CAMERA PICK FAILED", e);
      Alert.alert("Couldn’t open camera", "Please try again.");
    }
  };

  const openPhotoLibrary = async () => {
    try {
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
        name: asset.fileName || `textmom-${Date.now()}-${index}.jpg`,
        type: asset.mimeType || "image/jpeg",
      }));

      addPickedImages(nextImages);
    } catch (e) {
      console.log("TEXT MOM IMAGE PICK FAILED", e);
      Alert.alert("Couldn’t open photos", "Please try again.");
    }
  };

  const pickImages = () => {
    if (pickedImages.length >= 4) {
      Alert.alert("Image limit", "Maximum of 4 images.");
      return;
    }

    Alert.alert(
      "Add image",
      "Choose how you want to attach an image.",
      [
        { text: "Open Camera", onPress: openCamera },
        { text: "Choose from Photos", onPress: openPhotoLibrary },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleSend = async () => {
    if (isSending) return;

    const trimmed = draft.trim();
    const imagesToSend = [...pickedImages];

    if (!trimmed && imagesToSend.length === 0) {
      Alert.alert("Nothing to send", "Add a message or image.");
      return;
    }

    try {
      setIsSending(true);
      setLastMessage(null);

      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        Alert.alert("Not signed in", "Please sign in again.");
        return;
      }

      let activeThreadId = threadIdRef.current;

      if (!activeThreadId) {
        const threadResponse = await postJson("/v1/support_text_thread", {}, token);

        if (!threadResponse?.ok) {
          const msg =
            threadResponse?.json?.error ||
            threadResponse?.json?.message ||
            "Unable to start a new support thread.";
          Alert.alert("Send failed", msg);
          return;
        }

        const freshThread = threadResponse?.json?.thread || threadResponse?.json;

        if (!freshThread?.id) {
          Alert.alert("Send failed", "Unable to start a new support thread.");
          return;
        }

        setThread(freshThread);
        threadRef.current = freshThread;
        threadIdRef.current = freshThread.id;
        activeThreadId = freshThread.id;
        modeRef.current = "fresh";
        introEligibleRef.current = false;

        setStatusBanner({
          title: "Message sent",
          body: "Mom's Computer has your message. You can add more details here while you wait for a reply.",
          tone: "recent",
        });

        setShowLastThreadDivider(false);

        await subscribeToActiveThread(freshThread.id);
      }

      setDraft("");
      setPickedImages([]);

      const createdMessage = await sendSupportTextMessage(
        activeThreadId,
        trimmed,
        imagesToSend
      );

      introEligibleRef.current = false;
      sentInCurrentSessionRef.current = true;

      setStatusBanner({
        title: "Message sent",
        body: "Mom's Computer has your message. You can add more details here while you wait for a reply.",
        tone: "recent",
      });

      if (createdMessage) {
        appendLiveMessage(createdMessage, threadRef.current);
      }

      try {
        const rows = await fetchSupportTextThreads();
        setThreads(rows);
      } catch (e) {
        console.log("REFRESH SUPPORT TEXT THREADS FAILED", e);
      }

      await refreshMessages(true, activeThreadId ?? undefined);
      scrollToBottom(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to send.");
    } finally {
      setIsSending(false);
    }
  };

  const renderStatusBanner = () => {
    if (!statusBanner) return null;

    return (
      <View
        style={[
          styles.statusBanner,
          statusBanner.tone === "recent"
            ? styles.statusBannerRecent
            : styles.statusBannerFresh,
        ]}
      >
        <View
          style={[
            styles.statusBannerIconWrap,
            statusBanner.tone === "recent"
              ? styles.statusBannerIconWrapRecent
              : styles.statusBannerIconWrapFresh,
          ]}
        >
          <Ionicons
            name={
              statusBanner.tone === "recent"
                ? "time-outline"
                : "chatbubble-ellipses-outline"
            }
            size={16}
            color={statusBanner.tone === "recent" ? "#355E9A" : BRAND.blueDark}
          />
        </View>

        <View style={styles.statusBannerTextWrap}>
          <Text style={styles.statusBannerTitle}>{statusBanner.title}</Text>
          <Text style={styles.statusBannerBody}>{statusBanner.body}</Text>
        </View>
      </View>
    );
  };

  const renderNewMessageDebugPanel = () => {
    if (!SHOW_NEW_MESSAGE_BAR_DEBUG) return null;

    return (
      <View style={styles.debugPanel}>
        <View style={styles.debugPanelHeader}>
          <Text style={styles.debugPanelTitle}>Orange Bar Debug</Text>

          <Pressable
            onPress={forceOrangeBarForDebug}
            style={({ pressed }) => [
              styles.debugForceButton,
              pressed && styles.debugForceButtonPressed,
            ]}
          >
            <Text style={styles.debugForceButtonText}>Force Bar</Text>
          </Pressable>
        </View>

        <Text style={styles.debugPanelText}>
          threadId: {String(newMessageDebug.threadId)}
        </Text>
        <Text style={styles.debugPanelText}>
          savedLastSeenId: {String(newMessageDebug.savedLastSeenId)}
        </Text>
        <Text style={styles.debugPanelText}>
          incomingIds: {newMessageDebug.incomingIds.join(", ") || "none"}
        </Text>
        <Text style={styles.debugPanelText}>
          newIds: {newMessageDebug.newIds.join(", ") || "none"}
        </Text>
        <Text style={styles.debugPanelText}>
          notice: anchor {String(newMessageDebug.noticeAnchorId)} / count{" "}
          {String(newMessageDebug.noticeCount)}
        </Text>
        <Text style={styles.debugPanelText}>
          displayIds: {newMessageDebug.displayIds.join(", ") || "none"}
        </Text>
        <Text style={styles.debugPanelText}>
          lastEvent: {newMessageDebug.lastEvent}
        </Text>
      </View>
    );
  };

  const renderListHeader = () => {
    return (
      <>
        {renderStatusBanner()}
        {renderNewMessageDebugPanel()}
      </>
    );
  };

  const renderNewSupportNotice = (count = 1) => {
    const plural = count > 1;

    return (
      <View style={styles.newMessageBarWrap}>
        <View style={styles.newMessageLine} />

        <View style={styles.newMessageBar}>
          <Ionicons
            name="chevron-down-circle"
            size={14}
            color={BRAND.orangeDark}
          />

          <Text style={styles.newMessageText}>
            {plural ? `${count} new messages` : "New message"}
          </Text>
        </View>

        <View style={styles.newMessageLine} />
      </View>
    );
  };

  const renderMessage = ({ item }: { item: SupportTextRenderableMessage }) => {
    if (
      item.id === NEW_SUPPORT_MESSAGE_NOTICE_ID &&
      item.noticeKind === "new_support_messages"
    ) {
      return renderNewSupportNotice(item.noticeCount || 1);
    }

    if (item.id === LAST_THREAD_DIVIDER_ID && item.dividerLabel) {
      return (
        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerPill}>
            <Text style={styles.dividerText}>{item.dividerLabel}</Text>
          </View>
          <View style={styles.dividerLine} />
        </View>
      );
    }

    const mine = item.direction === "outbound_to_support";
    const system = item.direction === "system";
    const metaTime = formatMetaTime(item.created_at);

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
              <Text style={styles.systemLabel}>
                {item.author_agent_name || "Mom's Computer"}
              </Text>
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
                <Pressable
                  key={img.id}
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
                    onLoad={() => {
                      console.log("✅ IMAGE LOADED:", img.url);
                    }}
                    onError={(e) => {
                      console.log("❌ IMAGE FAILED:", img.url);
                      console.log("ERROR:", e?.nativeEvent);
                    }}
                  />
                </Pressable>
              ))}
            </View>
          )}

          {!system ? (
            <View style={styles.messageMetaRow}>
              <Text
                style={[
                  styles.messageMeta,
                  mine ? styles.messageMetaMine : styles.messageMetaTheirs,
                ]}
              >
                {mine ? item.status : item.author_agent_name || "Support"}
                {metaTime ? ` • ${metaTime}` : ""}
              </Text>
            </View>
          ) : (
            <View style={styles.messageMetaRow}>
              <Text style={[styles.messageMeta, styles.messageMetaSystem]}>
                {metaTime}
              </Text>
            </View>
          )}
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
          <HistoryDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            threads={threads}
            onSelectThread={handleSelectThread}
            onUpdateThreads={setThreads}
          />

          <ImagePreviewModal
            open={previewOpen}
            uri={previewUri}
            onClose={closePreview}
          />

          <View style={styles.headerWrap}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={() => setDrawerOpen(true)}
                style={({ pressed }) => [
                  styles.historyBtn,
                  pressed && styles.headerBtnPressed,
                ]}
              >
                <Ionicons name="menu" size={20} color={BRAND.blue} />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                {SHOW_DEBUG_DROPDOWN && (
                  <View style={styles.debugDropdownWrap}>
                    <DebugDropdown />
                  </View>
                )}

                <View style={styles.badgeRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.badgeText}>Live support thread</Text>
                </View>

                <Text style={titleStyle}>Text Mom</Text>

                <Text style={styles.headerSubtitle}>
                  {thread?.assigned_agent_name
                    ? `Connected with ${thread.assigned_agent_name}`
                    : "Direct support messaging"}
                </Text>
              </View>

              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.backBtn,
                  pressed && styles.headerBtnPressed,
                ]}
              >
                <Ionicons name="chevron-back" size={20} color={BRAND.blue} />
              </Pressable>
            </View>
          </View>

          {!!lastMessage && (
            <View style={styles.noticeCard}>
              <Ionicons
                name="information-circle"
                size={18}
                color={BRAND.blue}
              />
              <Text style={styles.noticeText}>{lastMessage}</Text>
            </View>
          )}

          {isBooting ? (
            <View style={styles.loadingWrap}>
              <View style={styles.loadingOrb}>
                <ActivityIndicator size="large" color={BRAND.blue} />
              </View>
              <Text style={styles.loadingTitle}>Opening support thread…</Text>
              <Text style={styles.loadingText}>
                Getting your latest messages ready.
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={displayMessages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                ListHeaderComponent={renderListHeader}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={() => {
                  if (displayMessages.length > 0) {
                    scrollToBottom(true);
                  }
                }}
                onLayout={() => {
                  if (displayMessages.length > 0) {
                    scrollToBottom(false);
                  }
                }}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({
                      offset: Math.max(0, info.averageItemLength * info.index),
                      animated: true,
                    });
                  }, 250);
                }}
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
                    placeholder="Type your message..."
                    placeholderTextColor={BRAND.mutedSoft}
                    multiline
                    style={styles.input}
                    textAlignVertical="top"
                    autoCorrect={true}
                    spellCheck={true}
                    autoCapitalize="sentences"
                    keyboardType="default"
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
                    {isSending ? (
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
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  historyBtn: {
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

  debugDropdownWrap: {
    marginBottom: 8,
    alignSelf: "flex-start",
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

  debugPanel: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },

  debugPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },

  debugPanelTitle: {
    color: "#92400E",
    fontFamily: FONT.medium,
    fontSize: 13,
  },

  debugForceButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: BRAND.orange,
  },

  debugForceButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  debugForceButtonText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 11,
  },

  debugPanelText: {
    color: "#92400E",
    fontFamily: FONT.regular,
    fontSize: 11,
    lineHeight: 16,
  },

  newMessageBarWrap: {
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    marginBottom: 14,
    paddingHorizontal: 0,
    gap: 10,
  },

  newMessageLine: {
    flex: 1,
    height: 1,
    minWidth: 0,
    backgroundColor: BRAND.orangeBorder,
    opacity: 0.85,
  },

  newMessageBar: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.orangeBorder,
    backgroundColor: BRAND.orangeSoft,
  },

  newMessageText: {
    color: BRAND.orangeDark,
    fontFamily: FONT.medium,
    fontSize: 12,
    letterSpacing: 0.15,
  },

  statusBanner: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  statusBannerRecent: {
    backgroundColor: "#F4F8FF",
    borderColor: "#D9E6FF",
  },

  statusBannerFresh: {
    backgroundColor: BRAND.blueSoft,
    borderColor: BRAND.blueBorder,
  },

  statusBannerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  statusBannerIconWrapRecent: {
    backgroundColor: "#E6F0FF",
  },

  statusBannerIconWrapFresh: {
    backgroundColor: "#DCEAFF",
  },

  statusBannerTextWrap: {
    flex: 1,
  },

  statusBannerTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 13,
    marginBottom: 2,
  },

  statusBannerBody: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 17,
  },

  noticeCard: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  noticeText: {
    flex: 1,
    color: BRAND.blueDark,
    fontFamily: FONT.medium,
    fontSize: 13,
    lineHeight: 18,
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

  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    marginTop: 2,
    gap: 10,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DCE5F0",
  },

  dividerPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#EFF5FF",
    borderWidth: 1,
    borderColor: "#D6E7FF",
  },

  dividerText: {
    color: "#58739A",
    fontFamily: FONT.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
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
    borderRadius: 14,
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
    borderRadius: 16,
  },

  pickedImage: {
    width: 68,
    height: 68,
    borderRadius: 16,
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
});