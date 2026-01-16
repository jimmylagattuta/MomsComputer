// app/src/services/api/conversations.ts
import * as SecureStore from "expo-secure-store";
import { getJson } from "./client";

export type ConversationSummary = {
  id: number;
  title: string | null;
  channel: string;
  status: string;
  risk_level: string;
  last_message_at: string | null;
  created_at: string;
};

export type ConversationMessageDTO = {
  id: number;
  sender_type: "user" | "ai" | string;
  content: string;
  content_type: string | null;
  risk_level: string | null;
  created_at: string;
};

export type ConversationDetailDTO = {
  conversation: ConversationSummary;
  messages: ConversationMessageDTO[];
};

type GetJsonEnvelope<T = any> = {
  ok: boolean;
  status: number;
  json: T;
};

async function requireToken() {
  const token = await SecureStore.getItemAsync("auth_token");
  if (!token) throw new Error("Missing auth token");
  return token;
}

export async function fetchConversations(
  q?: string
): Promise<ConversationSummary[]> {
  const token = await requireToken();

  const qs = q && q.trim().length ? `?q=${encodeURIComponent(q.trim())}` : "";

  const res = (await getJson(
    `/v1/conversations${qs}`,
    token
  )) as GetJsonEnvelope<ConversationSummary[]>;

  if (!res.ok)
    throw new Error(`Fetch conversations failed (${res.status})`);

  return Array.isArray(res.json) ? res.json : [];
}

export async function fetchConversation(
  conversationId: number
): Promise<ConversationDetailDTO> {
  const token = await requireToken();

  const res = (await getJson(
    `/v1/conversations/${conversationId}`,
    token
  )) as GetJsonEnvelope<ConversationDetailDTO>;

  if (!res.ok) throw new Error(`Fetch conversation failed (${res.status})`);

  return res.json as ConversationDetailDTO;
}
