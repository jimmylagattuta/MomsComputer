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

export type AskMomLimits = {
  tier: string;

  messages_used_today: number;
  messages_allowed_today: number;

  images_used_today: number;
  images_allowed_today: number;

  conversations_used_today: number;
  conversations_allowed_today: number;

  messages_used_in_conversation: number;
  messages_allowed_per_conversation: number;

  reset_at: string;
};

export type AskMomResponse = {
  conversation_id: number;
  message_id: number;
  risk_level: "low" | "medium" | "high" | string;
  summary: string;
  steps: string[];
  escalate_suggested: boolean;
  confidence: number;

  conversation_title?: string | null;

  show_contact_panel?: boolean;
  escalation_reason?: string | null;
  contact_actions?: ContactActions | null;
  locked_contact_actions?: ContactActions | null;
  contact_draft?: ContactDraft | null;
  contact_targets?: ContactTargets | null;

  user_message_id?: number;
  user_images?: string[];

  limits?: AskMomLimits;
};

type ApiEnvelope<T> = {
  ok: boolean;
  status: number;
  json: T | any;
};

type AskMomApiError = Error & {
  status?: number;
  json?: any;
};

async function safeParseJsonFromResponse(res: Response) {
  const text = await res.text();

  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { text, json };
}

function makeApiError({
  status,
  json,
  fallback,
}: {
  status: number;
  json: any;
  fallback: string;
}) {
  const message =
    json?.message ||
    json?.error ||
    fallback ||
    `AskMom failed (${status})`;

  const err = new Error(message) as AskMomApiError;
  err.status = status;
  err.json = json;

  return err;
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
          : ext === "heif"
            ? "image/heif"
            : "image/jpeg";

  return { name: filenameFromUri, type: mime };
}

export async function askMom(
  text: string,
  conversationId?: number,
  images: ComposerImage[] = []
): Promise<AskMomResponse> {
  const token = await SecureStore.getItemAsync("auth_token");

  if (!token) {
    throw new Error("Missing auth token");
  }

  // ✅ If images exist -> multipart
  if (images.length > 0) {
    const fd = new FormData();

    fd.append("text", text || "");

    if (conversationId) {
      fd.append("conversation_id", String(conversationId));
    }

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
        Accept: "application/json",
        // Do NOT set Content-Type manually for FormData in React Native.
      },
      body: fd as any,
    });

    const { json } = await safeParseJsonFromResponse(res);

    if (!res.ok) {
      throw makeApiError({
        status: res.status,
        json,
        fallback: `AskMom failed (${res.status})`,
      });
    }

    return json as AskMomResponse;
  }

  // ✅ No images -> JSON path
  const payload: any = { text };

  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  const res = (await postJson(
    "/v1/ask_mom",
    payload,
    token
  )) as ApiEnvelope<AskMomResponse>;

  if (!res.ok) {
    throw makeApiError({
      status: res.status,
      json: res.json,
      fallback: `AskMom failed (${res.status})`,
    });
  }

  return res.json as AskMomResponse;
}