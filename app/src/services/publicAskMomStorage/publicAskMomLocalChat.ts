// app/src/services/publicAskMomStorage/publicAskMomLocalChat.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ChatMessage } from "../../screens/AskMom/components/types";
import type { PublicAskMomResponse } from "../api/publicAskMom";

const PUBLIC_ASK_MOM_CHAT_KEY = "momscomputer:public_ask_mom_chat:v1";

type PublicAskMomLocalChatPayload = {
  saved_for_date: string;
  messages: ChatMessage[];
  last_limits: PublicAskMomResponse["limits"] | null;
};

export type PublicAskMomLocalChatLoadResult = {
  messages: ChatMessage[];
  last_limits: PublicAskMomResponse["limits"] | null;
};

function todayKey() {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function safeParseJson(raw: string | null) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeMessagesForStorage(messages: ChatMessage[]) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((m) => {
      if (!m) return false;

      // Do not restore a temporary "thinking..." message if the app was closed mid-request.
      if ((m as any).pending) return false;

      const hasText = String((m as any).text || "").trim().length > 0;
      const hasImages = Array.isArray((m as any).images) && (m as any).images.length > 0;

      return hasText || hasImages;
    })
    .map((m) => ({
      ...m,
      pending: false,
    }));
}

function isValidPayload(value: any): value is PublicAskMomLocalChatPayload {
  return (
    value &&
    typeof value === "object" &&
    typeof value.saved_for_date === "string" &&
    Array.isArray(value.messages)
  );
}

export async function loadPublicAskMomChat(): Promise<PublicAskMomLocalChatLoadResult | null> {
  const raw = await AsyncStorage.getItem(PUBLIC_ASK_MOM_CHAT_KEY);
  const parsed = safeParseJson(raw);

  if (!isValidPayload(parsed)) {
    return null;
  }

  if (parsed.saved_for_date !== todayKey()) {
    await clearPublicAskMomChat();
    return null;
  }

  return {
    messages: normalizeMessagesForStorage(parsed.messages),
    last_limits: parsed.last_limits || null,
  };
}

export async function savePublicAskMomChat({
  messages,
  last_limits,
}: {
  messages: ChatMessage[];
  last_limits: PublicAskMomResponse["limits"] | null;
}) {
  const payload: PublicAskMomLocalChatPayload = {
    saved_for_date: todayKey(),
    messages: normalizeMessagesForStorage(messages),
    last_limits: last_limits || null,
  };

  await AsyncStorage.setItem(PUBLIC_ASK_MOM_CHAT_KEY, JSON.stringify(payload));
}

export async function clearPublicAskMomChat() {
  await AsyncStorage.removeItem(PUBLIC_ASK_MOM_CHAT_KEY);
}

export { PUBLIC_ASK_MOM_CHAT_KEY };
