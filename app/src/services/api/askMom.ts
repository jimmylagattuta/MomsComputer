import { postJson } from "./client";

export async function askMom(message: string) {
  return postJson("/v1/ask_mom", { message });
}