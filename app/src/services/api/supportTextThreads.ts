// app/src/services/api/supportTextThreads.ts

import * as SecureStore from "expo-secure-store";
import { API_BASE, getJson, postJson } from "./client";

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

type PostJsonEnvelope<T = any> = {
  ok: boolean;
  status: number;
  json: T;
};

type UiImage = {
  uri: string;
  name?: string;
  type?: string;
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
    `textmom-${fallbackIndex}.jpg`;

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

export async function sendSupportTextMessage(
  threadId: number,
  body: string,
  images: UiImage[] = []
): Promise<SupportTextMessageDTO> {
  const token = await requireToken();

  console.log("SEND SUPPORT TEXT MESSAGE threadId:", threadId);
  console.log("SEND SUPPORT TEXT MESSAGE body:", JSON.stringify(body));
  console.log("SEND SUPPORT TEXT MESSAGE images length:", images.length);
  console.log("SEND SUPPORT TEXT MESSAGE images:", images);

  // ✅ MULTIPART PATH (IMAGE OR IMAGE + TEXT)
  if (images.length > 0) {
    console.log("SEND SUPPORT TEXT MESSAGE USING MULTIPART");

    const fd = new FormData();

    fd.append("thread_id", String(threadId));
    fd.append("body", body || "");

    images.forEach((img, idx) => {
      const uri = img?.uri;
      if (!uri) return;

      const fallback = filenameAndMimeFromUri(uri, idx);

      const payload = {
        uri,
        name: img?.name || fallback.name,
        type: img?.type || fallback.type,
      };

      console.log("APPENDING IMAGE:", payload);

      fd.append("images[]", payload as any);
    });

    const res = await fetch(`${API_BASE}/v1/support_text_messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: fd as any,
    });

    const { json } = await safeParseJsonFromResponse(res);

    console.log("MULTIPART RESPONSE STATUS:", res.status);
    console.log("MULTIPART RESPONSE JSON:", json);

    if (!res.ok) {
      throw new Error(
        json?.error || json?.message || `Send failed (${res.status})`
      );
    }

    return json?.message as SupportTextMessageDTO;
  }

  // ✅ TEXT ONLY PATH
  console.log("SEND SUPPORT TEXT MESSAGE USING JSON FALLBACK");

  const res = (await postJson(
    "/v1/support_text_messages",
    {
      thread_id: threadId,
      body,
      image_signed_ids: [],
    },
    token
  )) as PostJsonEnvelope<{ message: SupportTextMessageDTO }>;

  console.log("JSON FALLBACK RESPONSE STATUS:", res.status);
  console.log("JSON FALLBACK RESPONSE JSON:", res.json);

  if (!res.ok) {
    throw new Error(
      res?.json?.error || res?.json?.message || `Send failed (${res.status})`
    );
  }

  return res.json.message;
}