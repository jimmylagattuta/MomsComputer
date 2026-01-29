// app/src/screens/AskMom/AskMomScreen.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AskMomHeader from "./components/AskMomHeader";
import ChatComposer from "./components/ChatComposer";
import ChatMessageRow from "./components/ChatMessageRow";
import HistoryDrawer from "./components/HistoryDrawer";
import HomeFooterButton from "./components/HomeFooterButton";
import type { ChatMessage } from "./components/types";
import { BRAND, H_PADDING } from "./theme";

import { askMom } from "../../services/api/askMom";
import {
  ConversationSummary,
  fetchConversation,
  fetchConversations,
} from "../../services/api/conversations";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatAssistantText(summary: string, steps: string[]) {
  const lines: string[] = [];
  if (summary) lines.push(summary.trim());
  if (steps?.length) {
    lines.push("");
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

function roleFromSenderType(senderType: string) {
  return senderType === "user" ? "user" : "assistant";
}

// ✅ Warm "thinking" options (randomly picked per send)
const THINKING_OPTIONS = [
  // "Hang on, let me take a look",
  // "Okay — I’m checking on this",
  "One sec, I’m looking into it",
  // "Got it. Give me a moment",
  // "Alright, I’m on it",
  // "Let me double-check that",
  // "Hang tight — I’m reviewing this",
  // "Just a moment, I’m verifying a few things",
];

function pickThinkingText() {
  return THINKING_OPTIONS[Math.floor(Math.random() * THINKING_OPTIONS.length)];
}

export default function AskMomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView | null>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /** ✅ History drawer state */
  const [drawerOpen, setDrawerOpen] = useState(false);

  /** ✅ Preloaded conversations for drawer */
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | undefined>(
    undefined
  );

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const hasConversation = messages.length > 0;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  };

  // ✅ Preload conversation list on screen mount (non-blocking)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchConversations();
        if (!mounted) return;

        setConversations(data);
        console.log("PRELOADED CONVERSATIONS (AskMomScreen)", data);
      } catch (e: any) {
        console.log("PRELOAD CONVERSATIONS FAILED (AskMomScreen)", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Keyboard visibility (we can hide only the HOME footer button, not the composer)
  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // 🔁 Animated "Thinking…" dots
  const startThinkingAnimation = (thinkingId: string, base: string) => {
    let dots = 0;

    thinkingIntervalRef.current = setInterval(() => {
      dots = dots === 3 ? 0 : dots + 1;
      const t = `${base}${".".repeat(dots)}`;

      setMessages((prev) =>
        prev.map((m) => (m.id === thinkingId ? { ...m, text: t } : m))
      );
    }, 260);
  };

  const stopThinkingAnimation = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
  };

  const handleSelectConversation = async (id: number) => {
    setDrawerOpen(false);
    stopThinkingAnimation();
    setLoading(true);

    try {
      const detail = await fetchConversation(id);

      console.log("LOADED CONVERSATION DETAIL (AskMomScreen)", detail);

      setConversationId(id);

      const mapped: ChatMessage[] = (detail.messages || [])
        .filter((m) => (m?.content || "").trim().length > 0)
        .map((m) => ({
          id: String(m.id),
          role: roleFromSenderType(String(m.sender_type || "")) as any,
          text: String(m.content || ""),
          pending: false,
        }));

      setMessages(mapped);

      setTimeout(() => scrollToBottom(false), 50);
    } catch (e: any) {
      console.log("LOAD CONVERSATION FAILED (AskMomScreen)", e);
      Alert.alert(
        "Couldn’t load that chat",
        e?.message ? String(e.message) : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) {
      Alert.alert(
        "Type a message",
        "Ask anything about what you’re seeing or what happened."
      );
      return;
    }

    Keyboard.dismiss();
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { id: uid(), role: "user", text };

    const thinkingId = uid();
    const thinkingBase = pickThinkingText();

    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "assistant",
      text: thinkingBase,
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setTimeout(() => scrollToBottom(true), 30);

    startThinkingAnimation(thinkingId, thinkingBase);

    try {
      const res = await askMom(text, conversationId);

      if (!conversationId) setConversationId(res.conversation_id);

      const assistantText = formatAssistantText(res.summary, res.steps);

      stopThinkingAnimation();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: assistantText,
                pending: false,

                // ✅ attach contact panel fields onto assistant message
                show_contact_panel: !!res.show_contact_panel,
                escalation_reason: res.escalation_reason || null,
                contact_actions: res.contact_actions || null,
                contact_draft: res.contact_draft || null,
                contact_targets: res.contact_targets || null,
              }
            : m
        )
      );

      try {
        const updated = await fetchConversations();
        setConversations(updated);
        console.log("REFRESHED CONVERSATIONS (AskMomScreen)", updated);
      } catch (e) {
        console.log("REFRESH CONVERSATIONS FAILED (AskMomScreen)", e);
      }
    } catch (e: any) {
      stopThinkingAnimation();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text:
                  "I couldn’t reach the server right now. Please try again.\n\n(If this is urgent or involves money/codes, don’t proceed—tell me what it said.)",
                pending: false,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 30);
    }
  };

  const handleClear = () => {
    stopThinkingAnimation();
    Keyboard.dismiss();
    setInput("");
    setMessages([]);
    setLoading(false);
    setConversationId(undefined);
  };

  useEffect(() => {
    return () => stopThinkingAnimation();
  }, []);

  // ✅ FIX: Android insets.bottom can change after keyboard show/hide, causing a new gap.
  // Keep Android padding stable so the Home button always hugs the bottom.
  const footerSafePad = Platform.OS === "android" ? 8 : insets.bottom;

  // We ONLY hide the home footer button while typing.
  const showHomeFooterButton = !keyboardOpen;

  // Scroll padding should assume composer is always present.
  // Add extra only when HomeFooterButton is also present.
  const scrollBottomPad = showHomeFooterButton
    ? 12 + footerSafePad + 50 + 96
    : 12 + 96;

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={[styles.screen, { paddingTop: 25, paddingBottom: 0 }]}>
          <HistoryDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            conversations={conversations}
            onSelectConversation={handleSelectConversation}
            onUpdateConversations={setConversations}
          />

          <View style={styles.headerRow}>
            <AskMomHeader onOpenHistory={() => setDrawerOpen(true)} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: scrollBottomPad },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom(true)}
          >
            {hasConversation ? (
              <View style={styles.conversation}>
                {messages.map((m, idx) => (
                  <ChatMessageRow
                    key={m.id}
                    msg={m}
                    thread={messages}
                    index={idx}
                  />
                ))}
              </View>
            ) : (
              <View style={{ height: 6 }} />
            )}
          </ScrollView>

          {/* ✅ Bottom stack ALWAYS present so it rides above the keyboard */}
          <View>
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onClear={handleClear}
              disabled={loading || !input.trim()}
              loading={loading}
              hasConversation={hasConversation}
              messagesCount={messages.length}
            />

            {showHomeFooterButton ? (
              <View style={{ paddingBottom: footerSafePad }}>
                <HomeFooterButton onPress={() => router.replace("/(app)")} />
              </View>
            ) : (
              // Keep a tiny spacer so the composer doesn't "jump"
              <View style={{ height: 8 }} />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.screenBg },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: H_PADDING,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  content: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },

  conversation: {
    paddingBottom: 2,
  },
});
