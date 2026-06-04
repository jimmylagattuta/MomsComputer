// app/src/services/api/publicAskMom.ts
import { API_BASE, postJson } from "./client";

export type PublicAskMomImage = {
  uri: string;
  width?: number;
  height?: number;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
};

export type AskMomLimitPayload = {
  tier: "guest" | string;

  messages_used_today: number;
  messages_allowed_today: number;

  images_used_today: number;
  images_allowed_today: number;

  conversations_used_today: number;
  conversations_allowed_today: number;

  messages_used_in_conversation: number;
  messages_allowed_per_conversation: number;

  reset_at: string | null;
};

export type PublicAskMomResponse = {
  guest_id?: string;

  risk_level: "low" | "medium" | "high" | string;
  summary: string;
  steps: string[];

  escalate_suggested: boolean;
  confidence: number;

  show_contact_panel?: boolean;
  escalation_reason?: string | null;

  limits?: AskMomLimitPayload;

  error?: string;
  message?: string;
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

function filenameAndMimeFromUri(uri: string, fallbackIndex = 0) {
  const cleanUri = String(uri || "").split("?")[0]?.split("#")[0] || "";
  const filenameFromUri = cleanUri.split("/").pop() || `photo-${fallbackIndex}.jpg`;

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

  return {
    name: filenameFromUri,
    type: mime,
  };
}

function filenameAndMimeFromImage(img: PublicAskMomImage, fallbackIndex = 0) {
  const uri = img?.uri || "";
  const fromUri = filenameAndMimeFromUri(uri, fallbackIndex);

  const name =
    img.fileName ||
    fromUri.name ||
    `photo-${fallbackIndex}.jpg`;

  const type =
    img.mimeType ||
    img.type ||
    fromUri.type ||
    "image/jpeg";

  return { name, type };
}

export async function publicAskMom(
  guestId: string,
  text: string,
  images: PublicAskMomImage[] = []
): Promise<PublicAskMomResponse> {
  if (!guestId) {
    throw new Error("Missing guest id");
  }

  const cleanText = String(text || "");

  if (images.length > 0) {
    const fd = new FormData();

    fd.append("guest_id", guestId);
    fd.append("text", cleanText);

    images.forEach((img, idx) => {
      const uri = img?.uri;

      if (!uri) {
        return;
      }

      const { name, type } = filenameAndMimeFromImage(img, idx);

      fd.append("images[]", {
        uri,
        name,
        type,
      } as any);
    });

    const res = await fetch(`${API_BASE}/v1/public_ask_mom`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: fd as any,
    });

    const { json } = await safeParseJsonFromResponse(res);

    if (!res.ok) {
      const msg =
        json?.message ||
        json?.error ||
        `Public Ask Mom failed (${res.status})`;

      const err: any = new Error(msg);
      err.status = res.status;
      err.json = json;
      throw err;
    }

    return json as PublicAskMomResponse;
  }

  const res = await postJson("/v1/public_ask_mom", {
    guest_id: guestId,
    text: cleanText,
  });

  if (!res.ok) {
    const msg =
      res.json?.message ||
      res.json?.error ||
      `Public Ask Mom failed (${res.status})`;

    const err: any = new Error(msg);
    err.status = res.status;
    err.json = res.json;
    throw err;
  }

  return res.json as PublicAskMomResponse;
}