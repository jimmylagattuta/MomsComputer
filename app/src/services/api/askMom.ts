// app/src/services/api/askMom.ts
import * as SecureStore from "expo-secure-store";
import type { ComposerImage } from "../../screens/AskMom/components/types";
import { API_BASE, postJson } from "./client";

export type ContactDraft = {
  sms_body: string;
  email_subject: string;
  email_body: string;
};

export type ContactActions = {
  sms: boolean;
  email: boolean;
  call: boolean;
};

export type ContactTargets = {
  phone?: string | null;
  email?: string | null;
};

export type AskMomResponse = {
  conversation_id: number;
  message_id: number;
  risk_level: "low" | "medium" | "high" | string;
  summary: string;
  steps: string[];
  escalate_suggested: boolean;
  confidence: number;

  // ✅ NEW (added; backend may or may not include these)
  show_contact_panel?: boolean;
  escalation_reason?: string | null;
  contact_actions?: ContactActions | null;
  contact_draft?: ContactDraft | null;
  contact_targets?: ContactTargets | null;
};

type PostJsonEnvelope<T = any> = {
  ok: boolean;
  status: number;
  json: T;
};

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
    `photo-${fallbackIndex}.jpg`;

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

export async function askMom(
  text: string,
  conversationId?: number,
  images: ComposerImage[] = []
): Promise<AskMomResponse> {
  const token = await SecureStore.getItemAsync("auth_token");
  if (!token) throw new Error("Missing auth token");

  // ✅ If images exist -> multipart
  if (images.length > 0) {
    const fd = new FormData();

    fd.append("text", text || "");
    if (conversationId) fd.append("conversation_id", String(conversationId));

    images.forEach((img, idx) => {
      const uri = (img as any)?.uri;
      if (!uri) return;

      const { name, type } = filenameAndMimeFromUri(uri, idx);

      fd.append("images[]", {
        uri,
        name,
        type,
      } as any);
    });

    console.log("ASK MOM multipart images:", images.map((i: any) => i?.uri));

    const res = await fetch(`${API_BASE}/v1/ask_mom`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // ❌ DO NOT set Content-Type manually for FormData in React Native
      },
      body: fd as any,
    });

    const { json } = await safeParseJsonFromResponse(res);

    if (!res.ok) {
      throw new Error(`AskMom failed (${res.status})`);
    }

    return json as AskMomResponse;
  }

  // ✅ No images -> keep your existing JSON path
  const payload: any = { text };
  if (conversationId) payload.conversation_id = conversationId;

  const res = (await postJson(
    "/v1/ask_mom",
    payload,
    token
  )) as PostJsonEnvelope<AskMomResponse>;

  if (!res.ok) {
    throw new Error(`AskMom failed (${res.status})`);
  }

  return res.json;
}