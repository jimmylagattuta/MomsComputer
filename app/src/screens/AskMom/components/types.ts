// app/src/screens/AskMom/components/types.ts
export type ChatRole = "user" | "assistant";

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

export type ChatImage = {
  uri: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  pending?: boolean; // true for "Thinking..." placeholder

  // ✅ NEW: local UI images (optional)
  images?: ChatImage[];

  // ✅ Contact panel fields
  show_contact_panel?: boolean;
  escalation_reason?: string | null;
  contact_actions?: ContactActions | null;
  contact_draft?: ContactDraft | null;
  contact_targets?: ContactTargets | null;
};
