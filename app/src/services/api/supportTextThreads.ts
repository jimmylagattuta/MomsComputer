// supportTextThreads.ts
import * as SecureStore from "expo-secure-store";
import { getJson } from "./client";

export type SupportTextThreadSummary = {
  id: number;
  public_token: string | null;
  status: string | null;
  subject: string | null;
  priority: string | null;
  assigned_agent_name: string | null;
  started_at: string | null;
  last_message_at: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportTextMessageDTO = {
  id: number;
  direction: "outbound_to_support" | "inbound_from_support" | "system" | string;
  status: string;
  body: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  intro_message: boolean;
  visible_to_user: boolean;
  author_agent_name: string | null;
  images: Array<{
    id: number;
    url: string;
    filename: string;
    content_type: string;
    byte_size: number;
  }>;
};

export type SupportTextThreadDetailDTO = {
  thread: SupportTextThreadSummary;
  messages: SupportTextMessageDTO[];
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

export async function fetchSupportTextThreads(
  q?: string
): Promise<SupportTextThreadSummary[]> {
  const token = await requireToken();
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";

  const res = (await getJson(
    `/v1/support_text_threads${qs}`,
    token
  )) as GetJsonEnvelope<SupportTextThreadSummary[]>;

  if (!res.ok) {
    throw new Error(`Fetch support text threads failed (${res.status})`);
  }

  return Array.isArray(res.json) ? res.json : [];
}

export async function fetchSupportTextThread(
  threadId: number
): Promise<SupportTextThreadDetailDTO> {
  const token = await requireToken();

  const res = (await getJson(
    `/v1/support_text_threads/${threadId}`,
    token
  )) as GetJsonEnvelope<SupportTextThreadDetailDTO>;

  if (!res.ok) {
    throw new Error(`Fetch support text thread failed (${res.status})`);
  }

  return res.json as SupportTextThreadDetailDTO;
}