import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { changePassword } from "../src/services/auth";
import { FONT } from "../src/theme";

const IS_ANDROID = Platform.OS === "android";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  red: "#C62828",
  redSoft: "#FFF5F5",
  redBorder: "#FFD6D6",
  green: "#107C41",
  greenSoft: "#F1FFF5",
  greenBorder: "#CDEFD8",
};

type PasswordFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  textContentType: "password" | "newPassword" | "oneTimeCode" | "username" | "none";
  returnKeyType?: "next" | "done";
  onFocus?: () => void;
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
};

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisible,
  textContentType,
  returnKeyType = "next",
  onFocus,
  onSubmitEditing,
  inputRef,
}: PasswordFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.inputShell}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={textContentType}
          style={styles.input}
          returnKeyType={returnKeyType}
          blurOnSubmit={false}
        />

        <Pressable
          onPress={onToggleVisible}
          hitSlop={10}
          style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.75 }]}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
            color={BRAND.muted}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const currentPasswordRef = useRef<TextInput | null>(null);
  const newPasswordRef = useRef<TextInput | null>(null);
  const confirmPasswordRef = useRef<TextInput | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const scrollToY = (y: number) => {
    if (!IS_ANDROID) return;

    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y,
        animated: true,
      });
    }, 180);
  };

  const handleCurrentPasswordChange = (text: string) => {
    setCurrentPassword(text);
    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  };

  const handleConfirmPasswordChange = (text: string) => {
    setNewPasswordConfirmation(text);
    if (errorMessage) setErrorMessage("");
    if (successMessage) setSuccessMessage("");
  };

  const canSubmit = useMemo(() => {
    return (
      currentPassword.trim().length > 0 &&
      newPassword.trim().length > 0 &&
      newPasswordConfirmation.trim().length > 0 &&
      !submitting
    );
  }, [currentPassword, newPassword, newPasswordConfirmation, submitting]);

  const handleSubmit = async () => {
    if (submitting) return;

    setErrorMessage("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      const result = await changePassword({
        currentPassword,
        newPassword,
        newPasswordConfirmation,
      });

      if (!result.ok) {
        setErrorMessage(result.error || "Could not change password");
        scrollToY(240);
        return;
      }

      setSuccessMessage(result.data?.message || "Your password has been updated");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirmation("");

      Alert.alert("Password changed", "Your password has been updated successfully.");
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
      >
        <View style={styles.screen}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.backBtnPressed,
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={BRAND.blue} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="key-outline" size={26} color={BRAND.blue} />
              </View>

              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>
                Keep your account secure by updating your password.
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color={BRAND.red} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle-outline" size={18} color={BRAND.green} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <View style={styles.formCard}>
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChangeText={handleCurrentPasswordChange}
                placeholder="Enter your current password"
                visible={showCurrent}
                onToggleVisible={() => setShowCurrent((prev) => !prev)}
                textContentType="password"
                returnKeyType="next"
                inputRef={currentPasswordRef}
                onFocus={() => scrollToY(160)}
                onSubmitEditing={() => newPasswordRef.current?.focus()}
              />

              <PasswordField
                label="New Password"
                value={newPassword}
                onChangeText={handleNewPasswordChange}
                placeholder="Enter your new password"
                visible={showNew}
                onToggleVisible={() => setShowNew((prev) => !prev)}
                textContentType="newPassword"
                returnKeyType="next"
                inputRef={newPasswordRef}
                onFocus={() => scrollToY(260)}
                onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              />

              <PasswordField
                label="Confirm New Password"
                value={newPasswordConfirmation}
                onChangeText={handleConfirmPasswordChange}
                placeholder="Re-enter your new password"
                visible={showConfirm}
                onToggleVisible={() => setShowConfirm((prev) => !prev)}
                textContentType="newPassword"
                returnKeyType="done"
                inputRef={confirmPasswordRef}
                onFocus={() => scrollToY(380)}
                onSubmitEditing={handleSubmit}
              />

              <Text style={styles.helperText}>
                Use at least 8 characters. A longer password is even better.
              </Text>

              <Pressable
                onPress={handleSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (!canSubmit || submitting) && styles.submitBtnDisabled,
                  pressed && canSubmit && !submitting && styles.submitBtnPressed,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Update Password</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BRAND.pageBg,
  },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  topBar: {
    paddingBottom: 8,
  },

  backBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  backBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  backBtnText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: IS_ANDROID ? 220 : 40,
  },

  heroCard: {
    marginTop: 8,
    padding: 18,
    borderRadius: 22,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 14,
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 26 : 28,
    letterSpacing: 0.2,
  },

  subtitle: {
    marginTop: 8,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 14 : 15,
    lineHeight: IS_ANDROID ? 20 : 22,
  },

  formCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    marginBottom: 28,
  },

  fieldWrap: {
    marginBottom: 14,
  },

  label: {
    marginBottom: 8,
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
  },

  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BRAND.border,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    minHeight: 56,
    paddingLeft: 14,
    paddingRight: 10,
  },

  input: {
    flex: 1,
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 15 : 16,
    paddingVertical: 14,
  },

  eyeBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  helperText: {
    marginTop: 2,
    marginBottom: 16,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 12 : 13,
    lineHeight: IS_ANDROID ? 17 : 18,
  },

  submitBtn: {
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: BRAND.blue,
    borderWidth: 1,
    borderColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  submitBtnDisabled: {
    opacity: 0.6,
  },

  submitBtnPressed: {
    transform: [{ scale: 0.99 }],
  },

  submitBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 15 : 16,
    letterSpacing: 0.2,
  },

  errorBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: BRAND.redSoft,
    borderWidth: 1,
    borderColor: BRAND.redBorder,
  },

  errorText: {
    flex: 1,
    color: BRAND.red,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 18 : 19,
  },

  successBox: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: BRAND.greenSoft,
    borderWidth: 1,
    borderColor: BRAND.greenBorder,
  },

  successText: {
    flex: 1,
    color: BRAND.green,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 13 : 14,
    lineHeight: IS_ANDROID ? 18 : 19,
  },
});