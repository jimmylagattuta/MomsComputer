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
import HomeFooterButton from "./components/HomeFooterButton";
import type { ChatMessage } from "./components/types";
import { BRAND, H_PADDING } from "./theme";

import { askMom } from "../../services/api/askMom";

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

export default function AskMomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView | null>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | undefined>(
    undefined
  );

  const hasConversation = messages.length > 0;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  };

  // 🔁 Animated "Thinking…" dots (FAST)
  const startThinkingAnimation = (thinkingId: string) => {
    let dots = 1;

    thinkingIntervalRef.current = setInterval(() => {
      dots = dots === 4 ? 1 : dots + 1;
      const text = `Thinking${".".repeat(dots)}`;

      setMessages((prev) =>
        prev.map((m) => (m.id === thinkingId ? { ...m, text } : m))
      );
    }, 220);
  };

  const stopThinkingAnimation = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
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
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "assistant",
      text: "Thinking.",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setTimeout(() => scrollToBottom(true), 30);

    startThinkingAnimation(thinkingId);

    try {
      // ✅ Call backend (no artificial delay)
      const res = await askMom(text, conversationId);

      if (!conversationId) setConversationId(res.conversation_id);

      const assistantText = formatAssistantText(res.summary, res.steps);

      stopThinkingAnimation();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { ...m, text: assistantText, pending: false }
            : m
        )
      );

      // optional: if escalate suggested, lightly nudge (no tickets)
      if (res.escalate_suggested) {
        // Later: show “Call/Text/Email” quick actions.
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

  return (
    <SafeAreaView style={styles.page}>
      <View style={[styles.screen, { paddingTop: 25, paddingBottom: 0 }]}>
        <View style={styles.headerRow}>
          <AskMomHeader />
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(true)}
        >
          {hasConversation ? (
            <View style={styles.conversation}>
              {messages.map((m) => (
                <ChatMessageRow key={m.id} msg={m} />
              ))}
            </View>
          ) : (
            <View style={{ height: 6 }} />
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
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
        </KeyboardAvoidingView>

        <HomeFooterButton onPress={() => router.replace("/(app)")} />
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
