// app/src/screens/AskMom/components/ContactMomPanel.tsx
import React from "react";
import {
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

/**
 * TEMP DEFAULTS (safe for demo / MVP)
 * Replace later with org / user settings.
 */
const DEFAULT_PHONE = "+15551234567";
const DEFAULT_EMAIL = "support@momcomputer.com";

type ContactActions = {
  sms: boolean;
  email: boolean;
  call: boolean;
};

type ContactDraft = {
  sms_body?: string;
  email_subject?: string;
  email_body?: string;
};

export default function ContactMomPanel({
  visible,
  actions,
  phoneNumber,
  email,
  draft,
}: {
  visible: boolean;
  actions?: ContactActions | null;
  phoneNumber?: string | null;
  email?: string | null;
  draft?: ContactDraft | null;
}) {
  if (!visible) return null;

  const finalPhone = (phoneNumber || DEFAULT_PHONE).trim();
  const finalEmail = (email || DEFAULT_EMAIL).trim();

  // ✅ Always prefer backend-provided drafts.
  // ✅ Fallbacks are only for safety in case backend didn't send a draft.
  const smsBody =
    (draft?.sms_body && String(draft.sms_body)) ||
    [
      "Hey — can you help me real quick?",
      "",
      "I’m stuck and not sure what to do next.",
      "",
      "What’s the next step I should try?",
    ].join("\n");

  const emailSubject =
    (draft?.email_subject && String(draft.email_subject)) || "Quick help needed";

  const emailBody =
    (draft?.email_body && String(draft.email_body)) ||
    [
      "Hi,",
      "",
      "I’m using Mom’s Computer and I’m not sure what to do next.",
      "",
      "I’m stuck and not sure what to do next.",
      "",
      "What’s the next step I should try?",
      "",
      "— Sent from Mom’s Computer",
    ].join("\n");

  const openSMS = () => {
    const body = encodeURIComponent(smsBody);

    // iOS uses &body, Android uses ?body
    const url =
      Platform.OS === "ios"
        ? `sms:${finalPhone}&body=${body}`
        : `sms:${finalPhone}?body=${body}`;

    Linking.openURL(url);
  };

  const openEmail = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    const url = `mailto:${finalEmail}?subject=${subject}&body=${body}`;
    Linking.openURL(url);
  };

  const openCall = () => {
    const url = `tel:${finalPhone}`;
    Linking.openURL(url);
  };

  const showSMS = actions?.sms !== false;
  const showEmail = actions?.email !== false;
  const showCall = actions?.call !== false;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Contact Mom</Text>
      <Text style={styles.subtitle}>
        Tap a button below and we’ll open your phone with a pre-filled message.
      </Text>

      <View style={styles.btnRow}>
        {showSMS && (
          <Pressable
            style={[styles.btn, styles.btnGrow, styles.primary]}
            onPress={openSMS}
          >
            <Text style={[styles.btnText, styles.primaryText]}>Text Mom</Text>
          </Pressable>
        )}

        {showEmail && (
          <Pressable
            style={[styles.btn, styles.btnGrow, styles.secondary]}
            onPress={openEmail}
          >
            <Text style={[styles.btnText, styles.secondaryText]}>Email Mom</Text>
          </Pressable>
        )}
      </View>

      {showCall && (
        <Pressable style={[styles.btn, styles.call]} onPress={openCall}>
          <Text style={[styles.btnText, styles.callText]}>Call Mom</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D7DEE8",
    backgroundColor: "#FFFFFF",
    padding: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B1220",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#4B5563",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGrow: {
    flex: 1,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "800",
  },
  primary: {
    backgroundColor: "#0B1220",
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondary: {
    backgroundColor: "#EEF2F7",
  },
  secondaryText: {
    color: "#0B1220",
  },
  call: {
    marginTop: 10,
    backgroundColor: "#EEF2F7",
    borderWidth: 1,
    borderColor: "#D7DEE8",
  },
  callText: {
    color: "#0B1220",
  },
});
