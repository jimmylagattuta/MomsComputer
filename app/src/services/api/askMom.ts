// app/src/services/api/askMom.ts
import * as SecureStore from "expo-secure-store";
import { postJson } from "./client";

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

export async function askMom(
  text: string,
  conversationId?: number
): Promise<AskMomResponse> {
  const token = await SecureStore.getItemAsync("auth_token");
  if (!token) throw new Error("Missing auth token");

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
