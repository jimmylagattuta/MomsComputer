export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  pending?: boolean; // true for "Thinking..." placeholder
};