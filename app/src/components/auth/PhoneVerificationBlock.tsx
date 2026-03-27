import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { requestPhoneCode, verifyPhoneCode } from "../../services/auth";
import { FONT } from "../../theme";
import {
    formatUsPhoneInput,
    looksLikeCompleteUsPhone,
    normalizeUsPhoneDigits,
} from "../../utils/phone";

const BRAND = {
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  inputBg: "#FFFFFF",
  danger: "#D92D20",
  dangerSoft: "#FEF3F2",
  ok: "#039855",
  okSoft: "#ECFDF3",
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  verificationToken: string;
  onVerificationTokenChange: (token: string) => void;
};

const RESEND_SECONDS = 30;

export default function PhoneVerificationBlock({
  value,
  onChange,
  verified,
  onVerifiedChange,
  verificationToken,
  onVerificationTokenChange,
}: Props) {
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasSentCode, setHasSentCode] = useState(false);

  const formattedValue = useMemo(() => formatUsPhoneInput(value), [value]);
  const phoneComplete = useMemo(() => looksLikeCompleteUsPhone(value), [value]);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  function handlePhoneChange(input: string) {
    const formatted = formatUsPhoneInput(input);

    onChange(formatted);

    if (verified) {
      onVerifiedChange(false);
      onVerificationTokenChange("");
      setCode("");
      setHasSentCode(false);
      setInfoMessage("");
    }

    if (phoneError) setPhoneError("");
    if (codeError) setCodeError("");
  }

  async function handleSendCode() {
    setPhoneError("");
    setCodeError("");
    setInfoMessage("");

    if (!phoneComplete) {
      setPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }

    setSendingCode(true);

    const result = await requestPhoneCode(value);

    setSendingCode(false);

    if (!result.ok) {
      setPhoneError(result.error || "Unable to send verification code.");
      return;
    }

    setHasSentCode(true);
    setResendCooldown(RESEND_SECONDS);
    setInfoMessage("We sent a 6-digit verification code to your phone.");
  }

  async function handleVerifyCode() {
    setPhoneError("");
    setCodeError("");
    setInfoMessage("");

    const cleanCode = normalizeUsPhoneDigits(code).slice(0, 6);

    if (!phoneComplete) {
      setPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }

    if (cleanCode.length !== 6) {
      setCodeError("Please enter the 6-digit verification code.");
      return;
    }

    setVerifyingCode(true);

    const result = await verifyPhoneCode(value, cleanCode);

    setVerifyingCode(false);

    if (!result.ok) {
      setCodeError(result.error || "Invalid or expired verification code.");
      return;
    }

    onVerifiedChange(true);
    onVerificationTokenChange(result.data?.verificationToken || "");
    setInfoMessage("Phone number verified.");
  }

  function handleCodeChange(input: string) {
    const digits = input.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (codeError) setCodeError("");
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, phoneError ? styles.inputRowError : null, verified ? styles.inputRowVerified : null]}>
        <Ionicons name="call" size={22} color={BRAND.blue} />
        <TextInput
          value={formattedValue}
          onChangeText={handlePhoneChange}
          placeholder="(555) 555-5555"
          placeholderTextColor="#98A2B3"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!verified && !sendingCode && !verifyingCode}
          style={styles.input}
          maxLength={14}
        />
        {verified ? (
          <Ionicons name="checkmark-circle" size={20} color={BRAND.ok} />
        ) : formattedValue.trim().length > 0 ? (
          <Ionicons
            name={phoneComplete ? "checkmark-circle" : "close-circle"}
            size={20}
            color={phoneComplete ? BRAND.ok : BRAND.muted}
            style={{ opacity: 0.9 }}
          />
        ) : null}
      </View>

      {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

      {!verified && (
        <>
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (!phoneComplete || sendingCode) ? styles.buttonDisabled : null,
                pressed && phoneComplete && !sendingCode ? { opacity: 0.9 } : null,
              ]}
              onPress={handleSendCode}
              disabled={!phoneComplete || sendingCode}
            >
              {sendingCode ? (
                <ActivityIndicator color={BRAND.blue} />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={BRAND.blue} />
                  <Text style={styles.primaryButtonText}>
                    {hasSentCode ? "Resend Code" : "Send Code"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {hasSentCode ? (
            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Verification Code</Text>
              <Text style={styles.codeHelper}>
                Enter the 6-digit code we texted to your phone.
              </Text>

              <View style={[styles.inputRow, codeError ? styles.inputRowError : null]}>
                <Ionicons name="key-outline" size={22} color={BRAND.blue} />
                <TextInput
                  value={code}
                  onChangeText={handleCodeChange}
                  placeholder="123456"
                  placeholderTextColor="#98A2B3"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
                  style={styles.input}
                />
              </View>

              {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}

              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (code.length !== 6 || verifyingCode) ? styles.buttonDisabled : null,
                    pressed && code.length === 6 && !verifyingCode ? { opacity: 0.9 } : null,
                  ]}
                  onPress={handleVerifyCode}
                  disabled={code.length !== 6 || verifyingCode}
                >
                  {verifyingCode ? (
                    <ActivityIndicator color={BRAND.blue} />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark-outline" size={18} color={BRAND.blue} />
                      <Text style={styles.primaryButtonText}>Verify Phone</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    (resendCooldown > 0 || sendingCode) ? styles.buttonDisabled : null,
                    pressed && resendCooldown === 0 && !sendingCode ? { opacity: 0.9 } : null,
                  ]}
                  onPress={handleSendCode}
                  disabled={resendCooldown > 0 || sendingCode}
                >
                  <Text style={styles.secondaryButtonText}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      )}

      {infoMessage ? (
        <View style={verified ? styles.infoSuccessBox : styles.infoBox}>
          <Ionicons
            name={verified ? "checkmark-circle" : "information-circle"}
            size={16}
            color={verified ? BRAND.ok : BRAND.blue}
          />
          <Text style={[styles.infoText, verified ? styles.infoTextSuccess : null]}>
            {infoMessage}
          </Text>
        </View>
      ) : null}

      {!!verificationToken && !verified ? (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={16} color={BRAND.blue} />
          <Text style={styles.infoText}>Verification token ready.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    backgroundColor: BRAND.inputBg,
  },
  inputRowError: {
    borderColor: BRAND.danger,
  },
  inputRowVerified: {
    borderColor: "#D1FADF",
    backgroundColor: "#FCFFFD",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: BRAND.text,
    fontFamily: FONT.regular,
    paddingVertical: 0,
  },

  errorText: {
    color: BRAND.danger,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.medium,
    marginTop: 8,
  },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },

  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: BRAND.text,
    fontSize: 15,
    fontFamily: FONT.medium,
  },
  secondaryButtonText: {
    color: BRAND.muted,
    fontSize: 14,
    fontFamily: FONT.medium,
  },
  buttonDisabled: {
    opacity: 0.55,
  },

  codeSection: {
    marginTop: 14,
  },
  codeLabel: {
    fontSize: 13,
    color: BRAND.text,
    fontFamily: FONT.medium,
    marginBottom: 6,
  },
  codeHelper: {
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    marginBottom: 8,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },
  infoSuccessBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: BRAND.okSoft,
    borderWidth: 1,
    borderColor: "#D1FADF",
  },
  infoText: {
    flex: 1,
    color: BRAND.blue,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.regular,
  },
  infoTextSuccess: {
    color: BRAND.ok,
  },
});