import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { FONT } from "../../../../src/theme";
import { getJson } from "../../../services/api/client";

const POLL_MS = 2500;
const MAX_SNAPSHOTS = 60;

const BRAND = {
  card: "#FFFFFF",
  border: "#D6E7FF",
  soft: "#EEF5FF",
  soft2: "#F8FBFF",
  text: "#0F172A",
  muted: "#64748B",
  blue: "#1D6FE9",
  blueDark: "#1259C8",
  red: "#DC2626",
  green: "#16A34A",
  amber: "#D97706",
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type SnapshotSection = {
  label: string;
  data: JsonValue;
};

type DebugSnapshot = {
  id: string;
  createdAt: string;
  fingerprint: string;
  changedKeys: string[];
  sections: SnapshotSection[];
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return `"Unable to stringify value"`;
  }
}

function compactThread(thread: any) {
  if (!thread) return null;

  return {
    id: thread.id ?? null,
    status: thread.status ?? null,
    subject: thread.subject ?? null,
    priority: thread.priority ?? null,
    assigned_agent_name: thread.assigned_agent_name ?? null,
    started_at: thread.started_at ?? null,
    last_message_at: thread.last_message_at ?? null,
    last_user_message_at: thread.last_user_message_at ?? null,
    last_support_message_at: thread.last_support_message_at ?? null,
    cooldown_until: thread.cooldown_until ?? null,
    created_at: thread.created_at ?? null,
    updated_at: thread.updated_at ?? null,
    user_unread: thread.user_unread ?? null,
    support_unread: thread.support_unread ?? null,
    metadata: thread.metadata ?? null,
    support_identity_snapshot: thread.support_identity_snapshot ?? null,
  };
}

function compactThreads(threads: any[]) {
  return (threads || []).map((thread) => compactThread(thread));
}

function compactSupportMessages(messages: any[]) {
  return (messages || []).map((message) => ({
    id: message.id ?? null,
    support_text_thread_id: message.support_text_thread_id ?? null,
    direction: message.direction ?? null,
    status: message.status ?? null,
    body: message.body ?? null,
    intro_message: message.intro_message ?? null,
    visible_to_user: message.visible_to_user ?? null,
    author_agent_id: message.author_agent_id ?? null,
    author_agent_name: message.author_agent_name ?? null,
    sent_at: message.sent_at ?? null,
    delivered_at: message.delivered_at ?? null,
    read_at: message.read_at ?? null,
    failed_at: message.failed_at ?? null,
    failure_reason: message.failure_reason ?? null,
    created_at: message.created_at ?? null,
    updated_at: message.updated_at ?? null,
    metadata: message.metadata ?? null,
    images: Array.isArray(message.images)
      ? message.images.map((img: any) => ({
          id: img.id ?? null,
          filename: img.filename ?? null,
          content_type: img.content_type ?? null,
          byte_size: img.byte_size ?? null,
          url: img.url ?? null,
        }))
      : [],
  }));
}

function compactConversation(conversation: any) {
  if (!conversation) return null;

  return {
    id: conversation.id ?? null,
    channel: conversation.channel ?? null,
    status: conversation.status ?? null,
    risk_level: conversation.risk_level ?? null,
    summary: conversation.summary ?? null,
    last_message_at: conversation.last_message_at ?? null,
    created_at: conversation.created_at ?? null,
    updated_at: conversation.updated_at ?? null,
    metadata: conversation.metadata ?? null,
    escalation_ticket: conversation.escalation_ticket ?? null,
    messages:
      Array.isArray(conversation.messages) && conversation.messages.length
        ? conversation.messages.map((message: any) => ({
            id: message.id ?? null,
            sender_type: message.sender_type ?? null,
            sender_id: message.sender_id ?? null,
            content: message.content ?? null,
            content_type: message.content_type ?? null,
            risk_level: message.risk_level ?? null,
            ai_model: message.ai_model ?? null,
            ai_prompt_version: message.ai_prompt_version ?? null,
            ai_confidence: message.ai_confidence ?? null,
            metadata: message.metadata ?? null,
            created_at: message.created_at ?? null,
            updated_at: message.updated_at ?? null,
          }))
        : undefined,
  };
}

function compactConversations(conversations: any[]) {
  return (conversations || []).map((conversation) => compactConversation(conversation));
}

export default function DebugDropdown() {
  const [open, setOpen] = useState(false);
  const [expandedSnapshotIds, setExpandedSnapshotIds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<DebugSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleSnapshot = useCallback((id: string) => {
    setExpandedSnapshotIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]
    );
  }, []);

  const addSnapshot = useCallback((sections: SnapshotSection[]) => {
    const fingerprint = safeStringify(sections);

    if (lastFingerprintRef.current === fingerprint) return;

    const previous = snapshots[0];
    const previousMap = new Map(
      (previous?.sections || []).map((section) => [section.label, safeStringify(section.data)])
    );

    const changedKeys = sections
      .filter((section) => previousMap.get(section.label) !== safeStringify(section.data))
      .map((section) => section.label);

    const snapshot: DebugSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      fingerprint,
      changedKeys,
      sections,
    };

    lastFingerprintRef.current = fingerprint;

    setSnapshots((prev) => [snapshot, ...prev].slice(0, MAX_SNAPSHOTS));
    setExpandedSnapshotIds((prev) => [snapshot.id, ...prev].slice(0, MAX_SNAPSHOTS));
  }, [snapshots]);

  const takeSnapshot = useCallback(async () => {
    try {
      setIsLoading(true);
      setLastError(null);

      const token = await SecureStore.getItemAsync("auth_token");
      if (!token) {
        setLastError("Missing auth token");
        return;
      }

      const [
        currentThreadRes,
        threadListRes,
        conversationsRes,
      ] = await Promise.all([
        getJson("/v1/support_text_thread", token).catch(() => null),
        getJson("/v1/support_text_threads", token).catch(() => null),
        getJson("/v1/conversations", token).catch(() => null),
      ]);

      const currentThreadRaw =
        currentThreadRes?.ok
          ? currentThreadRes?.json?.thread || currentThreadRes?.json || null
          : null;

      const threadListRaw =
        threadListRes?.ok
          ? Array.isArray(threadListRes?.json)
            ? threadListRes?.json
            : threadListRes?.json?.threads || []
          : [];

      const conversationsRaw =
        conversationsRes?.ok
          ? Array.isArray(conversationsRes?.json)
            ? conversationsRes?.json
            : conversationsRes?.json?.conversations || []
          : [];

      const currentThreadId =
        currentThreadRaw?.id ??
        threadListRaw?.[0]?.id ??
        null;

      const currentConversationId =
        conversationsRaw?.[0]?.id ?? null;

      const [
        threadDetailRes,
        threadMessagesRes,
        conversationDetailRes,
      ] = await Promise.all([
        currentThreadId
          ? getJson(`/v1/support_text_threads/${currentThreadId}`, token).catch(() => null)
          : Promise.resolve(null),
        currentThreadId
          ? getJson(`/v1/support_text_messages?thread_id=${currentThreadId}`, token).catch(() => null)
          : Promise.resolve(null),
        currentConversationId
          ? getJson(`/v1/conversations/${currentConversationId}`, token).catch(() => null)
          : Promise.resolve(null),
      ]);

      const threadDetailRaw =
        threadDetailRes?.ok
          ? threadDetailRes?.json?.thread || threadDetailRes?.json || null
          : null;

      const threadDetailMessagesRaw =
        threadDetailRes?.ok
          ? threadDetailRes?.json?.messages || []
          : [];

      const threadMessagesRaw =
        threadMessagesRes?.ok
          ? threadMessagesRes?.json?.messages || threadMessagesRes?.json || []
          : [];

      const conversationDetailRaw =
        conversationDetailRes?.ok
          ? conversationDetailRes?.json?.conversation ||
            conversationDetailRes?.json ||
            null
          : null;

      const sections: SnapshotSection[] = [
        {
          label: "support_text_thread current",
          data: compactThread(currentThreadRaw),
        },
        {
          label: "support_text_threads index",
          data: compactThreads(threadListRaw),
        },
        {
          label: "support_text_threads/:id detail",
          data: {
            thread: compactThread(threadDetailRaw),
            messages: compactSupportMessages(threadDetailMessagesRaw),
          },
        },
        {
          label: "support_text_messages current-thread index",
          data: compactSupportMessages(threadMessagesRaw),
        },
        {
          label: "conversations index",
          data: compactConversations(conversationsRaw),
        },
        {
          label: "conversations/:id detail",
          data: compactConversation(conversationDetailRaw),
        },
        {
          label: "diagnostics",
          data: {
            chosen_support_text_thread_id: currentThreadId,
            chosen_conversation_id: currentConversationId,
            current_thread_status_code: currentThreadRes?.status ?? null,
            threads_index_status_code: threadListRes?.status ?? null,
            thread_detail_status_code: threadDetailRes?.status ?? null,
            thread_messages_status_code: threadMessagesRes?.status ?? null,
            conversations_index_status_code: conversationsRes?.status ?? null,
            conversation_detail_status_code: conversationDetailRes?.status ?? null,
            current_thread_ok: !!currentThreadRes?.ok,
            threads_index_ok: !!threadListRes?.ok,
            thread_detail_ok: !!threadDetailRes?.ok,
            thread_messages_ok: !!threadMessagesRes?.ok,
            conversations_index_ok: !!conversationsRes?.ok,
            conversation_detail_ok: !!conversationDetailRes?.ok,
          },
        },
      ];

      addSnapshot(sections);
    } catch (error: any) {
      setLastError(error?.message || "Snapshot failed");
    } finally {
      setIsLoading(false);
    }
  }, [addSnapshot]);

  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      return;
    }

    void takeSnapshot();

    pollRef.current = setInterval(() => {
      void takeSnapshot();
    }, POLL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, takeSnapshot]);

  const headerLabel = useMemo(() => {
    if (!snapshots.length) return "Debug snapshots";
    return `Debug snapshots (${snapshots.length})`;
  }, [snapshots.length]);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.triggerPressed,
          open && styles.triggerOpen,
        ]}
      >
        <View style={styles.triggerLeft}>
          <Ionicons
            name="bug-outline"
            size={14}
            color={open ? BRAND.blueDark : BRAND.blue}
          />
          <Text style={styles.triggerText}>{headerLabel}</Text>
        </View>

        <View style={styles.triggerRight}>
          {isLoading ? (
            <ActivityIndicator size="small" color={BRAND.blue} />
          ) : (
            <Ionicons
              name={open ? "chevron-up" : "chevron-down"}
              size={16}
              color={BRAND.blue}
            />
          )}
        </View>
      </Pressable>

      {open && (
        <View style={styles.dropdown}>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void takeSnapshot()}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && styles.actionBtnPressed,
              ]}
            >
              <Ionicons name="refresh" size={14} color={BRAND.blueDark} />
              <Text style={styles.actionBtnText}>Snapshot now</Text>
            </Pressable>

            <View style={styles.pollPill}>
              <View style={styles.pollDot} />
              <Text style={styles.pollText}>Polling every {POLL_MS / 1000}s</Text>
            </View>
          </View>

          {!!lastError && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={14} color={BRAND.red} />
              <Text style={styles.errorText}>{lastError}</Text>
            </View>
          )}

          {!snapshots.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No snapshots yet</Text>
              <Text style={styles.emptyBody}>
                Open this dropdown and it will start collecting thread and conversation
                snapshots without replacing older ones.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.snapshotList}
              contentContainerStyle={styles.snapshotListContent}
              nestedScrollEnabled
            >
              {snapshots.map((snapshot, index) => {
                const expanded = expandedSnapshotIds.includes(snapshot.id);

                return (
                  <View key={snapshot.id} style={styles.snapshotCard}>
                    <Pressable
                      onPress={() => toggleSnapshot(snapshot.id)}
                      style={({ pressed }) => [
                        styles.snapshotHeader,
                        pressed && styles.snapshotHeaderPressed,
                      ]}
                    >
                      <View style={styles.snapshotHeaderTop}>
                        <View style={styles.snapshotIndexPill}>
                          <Text style={styles.snapshotIndexText}>#{snapshots.length - index}</Text>
                        </View>

                        <Text style={styles.snapshotTime}>
                          {formatTime(snapshot.createdAt)}
                        </Text>

                        <Ionicons
                          name={expanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={BRAND.blue}
                        />
                      </View>

                      <View style={styles.changedRow}>
                        {(snapshot.changedKeys.length
                          ? snapshot.changedKeys
                          : ["no changes detected"]
                        ).map((key) => (
                          <View
                            key={`${snapshot.id}-${key}`}
                            style={[
                              styles.changedPill,
                              key === "no changes detected" && styles.changedPillMuted,
                            ]}
                          >
                            <Text
                              style={[
                                styles.changedPillText,
                                key === "no changes detected" && styles.changedPillTextMuted,
                              ]}
                              numberOfLines={1}
                            >
                              {key}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </Pressable>

                    {expanded && (
                      <View style={styles.snapshotBody}>
                        {snapshot.sections.map((section) => (
                          <View key={`${snapshot.id}-${section.label}`} style={styles.sectionCard}>
                            <Text style={styles.sectionLabel}>{section.label}</Text>
                            <ScrollView horizontal nestedScrollEnabled>
                              <Text style={styles.codeBlock}>
                                {safeStringify(section.data)}
                              </Text>
                            </ScrollView>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },

  trigger: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BRAND.soft,
    borderWidth: 1,
    borderColor: BRAND.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  triggerPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },

  triggerOpen: {
    backgroundColor: "#E8F1FF",
    borderColor: "#C7DBFF",
  },

  triggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },

  triggerRight: {
    minWidth: 18,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  triggerText: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  dropdown: {
    marginTop: 8,
    borderRadius: 18,
    backgroundColor: BRAND.card,
    borderWidth: 1,
    borderColor: BRAND.border,
    padding: 10,
    maxHeight: 420,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
    flexWrap: "wrap",
  },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#E8F1FF",
    borderWidth: 1,
    borderColor: "#C7DBFF",
  },

  actionBtnPressed: {
    opacity: 0.92,
  },

  actionBtnText: {
    color: BRAND.blueDark,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  pollPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BRAND.soft2,
    borderWidth: 1,
    borderColor: "#E3EBF4",
  },

  pollDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: BRAND.green,
  },

  pollText: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 11,
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FFD5DA",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
  },

  errorText: {
    flex: 1,
    color: BRAND.red,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EBF4",
    backgroundColor: BRAND.soft2,
    padding: 12,
  },

  emptyTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 13,
    marginBottom: 4,
  },

  emptyBody: {
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  snapshotList: {
    flexGrow: 0,
  },

  snapshotListContent: {
    paddingBottom: 4,
    gap: 10,
  },

  snapshotCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E3EBF4",
    backgroundColor: BRAND.soft2,
    overflow: "hidden",
  },

  snapshotHeader: {
    padding: 10,
    gap: 10,
  },

  snapshotHeaderPressed: {
    opacity: 0.94,
  },

  snapshotHeaderTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  snapshotIndexPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E8F1FF",
    borderWidth: 1,
    borderColor: "#C7DBFF",
  },

  snapshotIndexText: {
    color: BRAND.blueDark,
    fontFamily: FONT.medium,
    fontSize: 11,
  },

  snapshotTime: {
    flex: 1,
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  changedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },

  changedPill: {
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#EAF8EE",
    borderWidth: 1,
    borderColor: "#CAEAD4",
  },

  changedPillMuted: {
    backgroundColor: "#F2F4F7",
    borderColor: "#E3E8EF",
  },

  changedPillText: {
    color: "#0F7A38",
    fontFamily: FONT.medium,
    fontSize: 10,
  },

  changedPillTextMuted: {
    color: BRAND.muted,
  },

  snapshotBody: {
    borderTopWidth: 1,
    borderTopColor: "#E3EBF4",
    padding: 10,
    gap: 10,
  },

  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3EBF4",
    backgroundColor: "#FFFFFF",
    padding: 10,
  },

  sectionLabel: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 12,
    marginBottom: 8,
  },

  codeBlock: {
    minWidth: "100%",
    color: BRAND.text,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 11,
    lineHeight: 17,
  },
});