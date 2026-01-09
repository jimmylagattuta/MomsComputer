// app/src/screens/AskMom/AskMomScreen.tsx
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

// ✅ Flip this on/off when you want to see what the phone is receiving.
const DEMO_MODE = true;

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

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
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

  const showDemoAlert = (title: string, payload: any) => {
    if (!DEMO_MODE) return;

    const body = typeof payload === "string" ? payload : safeStringify(payload);

    // Alerts have practical length limits; keep it readable.
    const maxLen = 3500;
    const clipped =
      body.length > maxLen ? body.slice(0, maxLen) + "\n…(clipped)" : body;

    Alert.alert(title, clipped, [{ text: "OK" }], { cancelable: true });
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

    // ⏳ Min delay so it feels intentional (keep your vibe)
    const minThinkingMs = 900;
    const jitterMs = Math.floor(Math.random() * 500);
    await new Promise((r) => setTimeout(r, minThinkingMs + jitterMs));

    try {
      // ✅ Call backend
      const res = await askMom(text, conversationId);

      // ✅ Debug: show exactly what came back
      showDemoAlert("DEMO MODE — Raw /v1/ask_mom response", res);

      if (!conversationId) setConversationId(res.conversation_id);

      const assistantText = formatAssistantText(res.summary, res.steps);

      // ✅ Debug: show what we’re about to render
      showDemoAlert("DEMO MODE — Rendered assistantText", {
        summary: res.summary,
        steps: res.steps,
        assistantText,
        assistantText_length: assistantText?.length ?? 0,
      });

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

      showDemoAlert("DEMO MODE — Ask Mom error", {
        message: e?.message,
        name: e?.name,
        stack: e?.stack,
        raw: String(e),
      });

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

          {DEMO_MODE ? (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Demo Mode is ON",
                  "This will show alerts with the raw API response and what the UI is about to render.",
                  [{ text: "OK" }]
                )
              }
              style={({ pressed }) => [
                styles.demoChip,
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
              hitSlop={12}
            >
              <Text style={styles.demoChipText}>DEMO</Text>
            </Pressable>
          ) : null}
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

  demoChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignSelf: "flex-start",
    marginTop: 2,
  },

  demoChipText: {
    color: BRAND.blue,
    fontSize: 12,
    letterSpacing: 1.2,
    fontWeight: "700",
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
