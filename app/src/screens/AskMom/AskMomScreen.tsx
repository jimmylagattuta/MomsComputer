// app/src/screens/AskMom/AskMomScreen.tsx
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
import { mockAskMom } from "./mockAskMom";
import { BRAND, H_PADDING } from "./theme";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function AskMomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView | null>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ✅ Simple + reliable
  const hasConversation = messages.length > 0;

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) {
      Alert.alert("Type a message", "Ask anything about what you’re seeing or what happened.");
      return;
    }

    // ✅ close keyboard immediately on send (iOS + Android)
    Keyboard.dismiss();

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = { id: uid(), role: "user", text };
    const thinkingId = uid();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "assistant",
      text: "Thinking…",
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);

    // let layout update then scroll
    setTimeout(() => scrollToBottom(true), 30);

    // simulate API delay
    await new Promise((r) => setTimeout(r, 450));

    const response = mockAskMom(text);

    setMessages((prev) =>
      prev.map((m) => (m.id === thinkingId ? { ...m, text: response, pending: false } : m))
    );

    setLoading(false);

    setTimeout(() => scrollToBottom(true), 30);
  };

  const handleClear = () => {
    Keyboard.dismiss();
    setInput("");
    setMessages([]);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.page}>
      <View
        style={[
          styles.screen,
          {
            paddingTop: 25,
            // ✅ IMPORTANT: don't add bottom padding here or you'll create a keyboard gap
            paddingBottom: 0,
          },
        ]}
      >
        <AskMomHeader />

        {/* ✅ Chat messages scroll area (composer is NOT inside this ScrollView) */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollToBottom(true);
          }}
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

        {/* ✅ Composer attached to keyboard */}
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
            hasConversation={hasConversation} // ✅ FIX: was missing
            messagesCount={messages.length} // ✅ extra safety (optional, but now supported)
          />
        </KeyboardAvoidingView>

        {/* Footer stays below composer */}
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

  content: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },

  conversation: {
    paddingBottom: 2,
  },
});
