// app/src/services/api/askMom.ts
import * as SecureStore from "expo-secure-store";
import { postJson } from "./client";

export type AskMomResponse = {
  conversation_id: number;
  message_id: number;
  risk_level: "low" | "medium" | "high" | string;
  summary: string;
  steps: string[];
  escalate_suggested: boolean;
  confidence: number;
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

  // optional but helpful if the server ever changes / returns errors
  if (!res.ok) {
    throw new Error(`AskMom failed (${res.status})`);
  }

  return res.json;
}