// app/src/screens/AskMom/components/HistoryDrawer.tsx
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Keyboard,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ConversationSummary } from "../../../services/api/conversations";
import { fetchConversations } from "../../../services/api/conversations";
import { FONT } from "../../../theme"; // ✅ font tokens

const DRAWER_WIDTH = 320;
const HEADER_HEIGHT = 64;
const SEARCH_HEIGHT = 44;

function titleFor(c: ConversationSummary) {
  const t = (c as any).title ?? (c as any).summary ?? "";
  const s = String(t || "").trim();
  if (s) return s;

  const channel = String((c as any).channel || "").trim();
  if (channel) return channel === "ask_mom" ? "Ask Mom" : channel;

  return "Conversation";
}

function metaFor(c: ConversationSummary) {
  const risk = String((c as any).risk_level || "unknown");
  const ts = (c as any).last_message_at || (c as any).created_at;
  const when = ts ? new Date(ts).toLocaleString() : "";
  return when ? `${risk} · ${when}` : risk;
}

export default function HistoryDrawer({
  open,
  onClose,
  conversations,
  onSelectConversation,
  onUpdateConversations,
}: {
  open: boolean;
  onClose: () => void;
  conversations: ConversationSummary[];
  onSelectConversation: (conversationId: number) => void;
  onUpdateConversations: (rows: ConversationSummary[]) => void;
}) {
  const insets = useSafeAreaInsets();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [visible, setVisible] = useState(open);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const inputRef = useRef<TextInput | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevQueryRef = useRef<string>("");

  const headerPaddingTop =
    Platform.OS === "android" ? Math.max(insets.top, 8) : 0;

  const headerHeight =
    Platform.OS === "android"
      ? HEADER_HEIGHT + headerPaddingTop + SEARCH_HEIGHT
      : HEADER_HEIGHT + SEARCH_HEIGHT;

  useEffect(() => {
    if (open) {
      setVisible(true);

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      try {
        inputRef.current?.blur();
      } catch {}
      Keyboard.dismiss();

      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => setVisible(false));
    }
  }, [open, overlayOpacity, translateX]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const q = query.trim();
    const prev = prevQueryRef.current.trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      prevQueryRef.current = query;

      if (prev.length > 0) {
        debounceRef.current = setTimeout(async () => {
          setSearching(true);
          setSearchError(null);

          try {
            const rows = await fetchConversations("");
            onUpdateConversations(rows);
          } catch (e: any) {
            setSearchError(
              e?.message ? String(e.message) : "Failed to load conversations"
            );
          } finally {
            setSearching(false);
          }
        }, 150);
      } else {
        setSearching(false);
        setSearchError(null);
      }

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);

      try {
        const rows = await fetchConversations(q);
        onUpdateConversations(rows);
      } catch (e: any) {
        setSearchError(e?.message ? String(e.message) : "Search failed");
      } finally {
        setSearching(false);
      }
    }, 250);

    prevQueryRef.current = query;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, onUpdateConversations]);

  if (!visible) return null;

  const empty = !conversations || conversations.length === 0;
  const noResults = query.trim().length > 0 && empty;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <View
          style={[
            styles.header,
            { paddingTop: headerPaddingTop, height: headerHeight },
          ]}
        >
          <View style={styles.headerTopRow}>
            <Text style={styles.title}>History</Text>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeBtn,
                pressed ? styles.closeBtnPressed : null,
              ]}
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <TextInput
              ref={(r) => (inputRef.current = r)}
              value={query}
              onChangeText={setQuery}
              placeholder="Search inside conversations…"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              style={styles.searchInput}
            />

            {query.trim().length > 0 ? (
              <Pressable
                onPress={() => setQuery("")}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.clearBtn,
                  pressed ? styles.clearBtnPressed : null,
                ]}
              >
                <Text style={styles.clearText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {searching ? <Text style={styles.meta}>Searching…</Text> : null}
          {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

          {query.trim().length === 0 && empty ? (
            <Text style={styles.meta}>
              No conversations found yet. Start a chat and it’ll show up here.
            </Text>
          ) : null}

          {noResults ? (
            <Text style={styles.meta}>
              No conversations found for “{query.trim()}”.
            </Text>
          ) : null}

          {conversations.map((c) => (
            <Pressable
              key={(c as any).id}
              onPress={() => onSelectConversation((c as any).id)}
              android_ripple={{ color: "rgba(17,24,39,0.08)" }}
              style={({ pressed }) => [
                styles.row,
                pressed ? styles.rowPressed : null,
              ]}
            >
              {({ pressed }) => (
                <View style={styles.rowInner}>
                  <View
                    style={[
                      styles.pressBar,
                      pressed ? styles.pressBarOn : styles.pressBarOff,
                    ]}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{titleFor(c)}</Text>
                    <Text style={styles.rowMeta}>{metaFor(c)}</Text>
                    <Text style={styles.rowId}>#{(c as any).id}</Text>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,24,39,0.38)",
  },
  overlayPressable: { flex: 1 },

  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#FFFFFF",
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderRightWidth: 1,
    borderRightColor: "#E6EAF2",
    overflow: "hidden",
  },

  header: {
    paddingHorizontal: 14,
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    paddingBottom: 10,
    gap: 10,
  },

  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  title: {
    fontSize: 18,
    fontFamily: FONT.semi,
    color: "#111827",
  },

  closeBtn: {
    height: 36,
    width: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    backgroundColor: "#FFFFFF",
  },
  closeBtnPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  closeText: {
    fontSize: 18,
    fontFamily: FONT.semi,
    color: "#111827",
    marginTop: -1,
  },

  searchWrap: {
    height: SEARCH_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EAF2",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: Platform.OS === "ios" ? 17 : 15,
    lineHeight: Platform.OS === "ios" ? 22 : 20,
    color: "#111827",
    fontFamily: FONT.regular,
  },

  clearBtn: {
    height: 30,
    width: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6EAF2",
    backgroundColor: "#FFFFFF",
  },
  clearBtnPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  clearText: {
    fontSize: 14,
    fontFamily: FONT.semi,
    color: "#111827",
    marginTop: -1,
  },

  meta: {
    padding: 14,
    color: "#6B7280",
    fontFamily: FONT.regular,
  },
  error: {
    padding: 14,
    color: "#B91C1C",
    fontFamily: FONT.semi,
  },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  rowPressed: {
    backgroundColor: "#F3F4F6",
    borderBottomColor: "#E5E7EB",
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },

  rowInner: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  pressBar: { width: 4, borderRadius: 99 },
  pressBarOff: { backgroundColor: "transparent" },
  pressBarOn: { backgroundColor: "#111827" },

  rowBody: { flex: 1, paddingVertical: 2 },
  rowTitle: {
    fontFamily: FONT.semi,
    color: "#111827",
    fontSize: 14,
  },
  rowMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontFamily: FONT.regular,
  },
  rowId: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 6,
    fontFamily: FONT.regular,
  },
});
