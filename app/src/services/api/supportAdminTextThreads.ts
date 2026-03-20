import * as SecureStore from "expo-secure-store";
import { API_BASE, getJson, postJson } from "./client";

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

async function safeParseJsonFromResponse(res: Response) {
  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  return { text, json };
}

function filenameAndMimeFromUri(uri: string, fallbackIndex = 0) {
  const filenameFromUri =
    uri?.split("?")[0]?.split("#")[0]?.split("/").pop() ||
    `support-${Date.now()}-${fallbackIndex}.jpg`;

  const ext = (filenameFromUri.split(".").pop() || "jpg").toLowerCase();

  const mime =
    ext === "png"
      ? "image/png"
      : ext === "webp"
      ? "image/webp"
      : ext === "heic"
      ? "image/heic"
      : "image/jpeg";

  return { name: filenameFromUri, type: mime };
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
  images: Array<{ uri: string; name?: string; type?: string }> = []
): Promise<AdminSupportTextMessage> {
  const token = await requireToken();

  if (images.length > 0) {
    const fd = new FormData();
    fd.append("body", body || "");

    images.forEach((img, idx) => {
      const uri = img?.uri;
      if (!uri) return;

      const fallback = filenameAndMimeFromUri(uri, idx);

      fd.append("images[]", {
        uri,
        name: img?.name || fallback.name,
        type: img?.type || fallback.type,
      } as any);
    });

    const res = await fetch(
      `${API_BASE}/v1/support/text_threads/${threadId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: fd as any,
      }
    );

    const { json } = await safeParseJsonFromResponse(res);

    if (!res.ok) {
      throw new Error(
        json?.error || json?.message || `Unable to send reply (${res.status})`
      );
    }

    return json?.message as AdminSupportTextMessage;
  }

  const res = await postJson(
    `/v1/support/text_threads/${threadId}/messages`,
    {
      body,
      image_signed_ids: [],
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