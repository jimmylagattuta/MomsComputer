import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import {
  fetchAdminSupportThreads,
  type AdminSupportTextThreadSummary,
} from "../../services/api/supportAdminTextThreads";
import { BRAND, H_PADDING } from "../AskMom/theme";
import TextMomFooterHomeButton from "./components/TextMomFooterHomeButton";
import TextMomHeader from "./components/TextMomHeader";

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

function getDisplayName(thread: AdminSupportTextThreadSummary) {
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

export default function TextMomAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const FOOTER_MIN_HEIGHT = 56;
  const footerPaddingBottom = Math.max(insets.bottom, 12) + 10;
  const footerTotalHeight = FOOTER_MIN_HEIGHT + footerPaddingBottom;

  const [threads, setThreads] = useState<AdminSupportTextThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => threads.filter((t) => t.support_unread).length,
    [threads]
  );

  const loadThreads = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") setLoading(true);
      if (mode === "refresh") setRefreshing(true);

      setError(null);
      const rows = await fetchAdminSupportThreads();
      setThreads(rows);
    } catch (e: any) {
      setError(e?.message || "Unable to load support threads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadThreads("initial");
  }, []);

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right"]}>
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
              <Ionicons name="shield-checkmark" size={28} color={BRAND.blue} />
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
              <Ionicons name="mail-open-outline" size={30} color={BRAND.muted} />
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
                    key={thread.id}
                    onPress={() =>
                      router.push({
                        pathname: "/TextMom/TextMomAdminThreadScreen" as any,
                        params: { threadId: String(thread.id) },
                      })
                    }
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
                            <Text style={styles.threadUnreadPillText}>Unread</Text>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.pageBg },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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

  loadingText: {
    color: BRAND.muted,
    fontSize: 13,
    fontFamily: FONT.regular,
  },

  errorCard: {
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.card,
    borderRadius: 18,
    padding: 16,
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