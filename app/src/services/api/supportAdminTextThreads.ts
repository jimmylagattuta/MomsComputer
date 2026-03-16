import * as SecureStore from "expo-secure-store";
import { getJson, postJson } from "./client";

export type AdminSupportTextThreadSummary = {
  id: number;
  public_token: string | null;
  status: string | null;
  priority: string | null;
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  support_identity_snapshot: {
    first_name?: string | null;
    last_name?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  last_message_at: string | null;
  last_user_message_at: string | null;
  last_support_message_at: string | null;
  user_unread: boolean;
  support_unread: boolean;
};

export type AdminSupportTextMessage = {
  id: number;
  direction: "outbound_to_support" | "inbound_from_support" | "system" | string;
  status: string;
  body: string | null;
  sent_at: string | null;
  intro_message: boolean;
  visible_to_user: boolean;
  author_agent_id: number | null;
  author_agent_name: string | null;
  images: Array<{
    id: number;
    filename: string;
    content_type: string;
    byte_size: number;
    url: string;
  }>;
  created_at: string;
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

export async function fetchAdminSupportThreads(): Promise<
  AdminSupportTextThreadSummary[]
> {
  const token = await requireToken();

  const res = (await getJson(
    "/v1/support/text_threads",
    token
  )) as GetJsonEnvelope<{ threads: AdminSupportTextThreadSummary[] }>;

  if (!res.ok) {
    throw new Error(`Fetch admin support threads failed (${res.status})`);
  }

  return Array.isArray(res.json?.threads) ? res.json.threads : [];
}

export async function fetchAdminSupportThread(
  threadId: number
): Promise<AdminSupportTextThreadSummary> {
  const token = await requireToken();

  const res = (await getJson(
    `/v1/support/text_threads/${threadId}`,
    token
  )) as GetJsonEnvelope<{ thread: AdminSupportTextThreadSummary }>;

  if (!res.ok) {
    throw new Error(`Fetch admin support thread failed (${res.status})`);
  }

  return res.json.thread;
}

export async function fetchAdminSupportMessages(
  threadId: number
): Promise<AdminSupportTextMessage[]> {
  const token = await requireToken();

  const res = (await getJson(
    `/v1/support/text_threads/${threadId}/messages`,
    token
  )) as GetJsonEnvelope<{ messages: AdminSupportTextMessage[] }>;

  if (!res.ok) {
    throw new Error(`Fetch admin support messages failed (${res.status})`);
  }

  return Array.isArray(res.json?.messages) ? res.json.messages : [];
}

export async function sendAdminSupportMessage(
  threadId: number,
  body: string,
  image_signed_ids: string[] = []
): Promise<AdminSupportTextMessage> {
  const token = await requireToken();

  const res = await postJson(
    `/v1/support/text_threads/${threadId}/messages`,
    {
      body,
      image_signed_ids,
    },
    token
  );

  if (!res?.ok) {
    throw new Error(
      res?.json?.error || res?.json?.message || "Unable to send reply."
    );
  }

  return res.json?.message;
}