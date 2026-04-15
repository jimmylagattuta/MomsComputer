import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT } from "../../../src/theme";
import { useAuth } from "../../auth/AuthProvider";
import { postJson } from "../../services/api/client";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  debugBg: "#0F172A",
  debugBorder: "#1E293B",
  debugText: "#E2E8F0",
  debugMuted: "#94A3B8",
};

function safeStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function maskToken(token?: string | null) {
  if (!token) return "null";
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-6)}`;
}

export default function CallMomScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const auth = useAuth() as any;
  const user = auth?.user;
  const authKeys = auth ? Object.keys(auth) : [];

  const [isCalling, setIsCalling] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const [buttonPressCount, setButtonPressCount] = useState(0);
  const [secureStoreTokenPreview, setSecureStoreTokenPreview] = useState<string>("not checked");
  const [lastRequestDebug, setLastRequestDebug] = useState<any>(null);
  const [lastResponseDebug, setLastResponseDebug] = useState<any>(null);
  const [lastErrorDebug, setLastErrorDebug] = useState<any>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const titleStyle = useMemo(
    () => [styles.title, isNarrow && styles.titleNarrow],
    [isNarrow]
  );

  const addDebugLine = (line: string) => {
    const stamped = `[${new Date().toLocaleTimeString()}] ${line}`;
    setDebugLines((prev) => [stamped, ...prev].slice(0, 30));
  };

  const refreshSecureStoreToken = async () => {
    try {
      const stored = await SecureStore.getItemAsync("auth_token");
      const masked = maskToken(stored);
      setSecureStoreTokenPreview(masked);
      addDebugLine(`SecureStore auth_token checked: ${stored ? "FOUND" : "MISSING"}`);
      return stored;
    } catch (error: any) {
      const msg = error?.message || "Unknown SecureStore error";
      setSecureStoreTokenPreview(`error: ${msg}`);
      addDebugLine(`SecureStore auth_token read failed: ${msg}`);
      return null;
    }
  };

  const handleStartCall = async () => {
    if (isCalling) return;

    setButtonPressCount((prev) => prev + 1);
    addDebugLine("Start Call button tapped");

    Alert.alert(
      "Call Mom",
      "We will contact support and call you as soon as possible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Me",
          style: "default",
          onPress: async () => {
            try {
              setIsCalling(true);
              setLastMessage(null);
              setLastRequestDebug(null);
              setLastResponseDebug(null);
              setLastErrorDebug(null);

              addDebugLine("Call confirmation accepted");
              addDebugLine(`Auth keys present: ${authKeys.join(", ") || "(none)"}`);
              addDebugLine(`Auth user present: ${user ? "YES" : "NO"}`);

              const secureStoreToken = await refreshSecureStoreToken();
              addDebugLine(`Token preview from SecureStore: ${maskToken(secureStoreToken)}`);

              if (!secureStoreToken) {
                const notSignedInDebug = {
                  reason: "token_missing_before_request",
                  authKeys,
                  authHasUser: !!user,
                  authUser: user ?? null,
                  tokenFromSecureStore: null,
                };

                setLastErrorDebug(notSignedInDebug);
                setLastMessage("Please sign in again, then try calling support.");
                addDebugLine("Blocked before request because SecureStore token was missing");

                Alert.alert("Please Sign In", "Please sign in again, then try once more.");
                return;
              }

              const requestDebug = {
                path: "/v1/support_calls",
                body: {},
                tokenPreview: maskToken(secureStoreToken),
                authHasUser: !!user,
                authUser: user ?? null,
              };

              setLastRequestDebug(requestDebug);
              addDebugLine("Sending POST /v1/support_calls");

              const response = await postJson("/v1/support_calls", {}, secureStoreToken);

              setLastResponseDebug(response);
              addDebugLine(
                `Received response: status=${response?.status ?? "unknown"} ok=${String(response?.ok)}`
              );

              const backendMessage =
                response?.json?.message ||
                response?.json?.error ||
                "We are starting your support call now. Please watch for an incoming call.";

              if (!response?.ok) {
                setLastMessage(backendMessage);
                setLastErrorDebug(response);
                addDebugLine(`Backend returned non-ok response: ${backendMessage}`);
                Alert.alert("Unable to Start Call", backendMessage);
                return;
              }

              setLastMessage(backendMessage);

              Alert.alert(
                "We’re Calling You",
                backendMessage || "Please watch for an incoming call."
              );
            } catch (error: any) {
              const errorDebug = {
                message: error?.message || null,
                name: error?.name || null,
                stack: error?.stack || null,
                raw: error,
              };

              setLastErrorDebug(errorDebug);

              const message =
                error?.message ||
                "We could not start the call right now. Please try again.";

              addDebugLine(`Caught frontend error: ${message}`);

              setLastMessage(message);
              Alert.alert("Unable to Start Call", message);
            } finally {
              setIsCalling(false);
              addDebugLine("Call attempt finished");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={BRAND.blue} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="call" size={32} color={BRAND.blue} />
            </View>

            <Text style={titleStyle}>Need help right now?</Text>

            <Text style={styles.heroText}>
              Tap the button below and we will try to call you.
            </Text>

            <Text style={styles.heroSubtext}>
              This is for anything that feels suspicious, confusing, or urgent.
            </Text>
          </View>

          <View style={styles.reassuranceCard}>
            <View style={styles.reassuranceHeader}>
              <Ionicons name="shield-checkmark" size={20} color={BRAND.green} />
              <Text style={styles.reassuranceTitle}>You are not alone</Text>
            </View>

            <Text style={styles.reassuranceText}>
              Once you tap the button, our team will begin reaching out to you.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>What happens next</Text>

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>1</Text>
              </View>
              <Text style={styles.stepText}>Tap “Call Me.”</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.stepText}>Keep your phone nearby.</Text>
            </View>

            <View style={styles.stepRow}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.stepText}>Answer the incoming call from support.</Text>
            </View>
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <Ionicons name="information-circle" size={18} color={BRAND.blue} />
              <Text style={styles.tipTitle}>Helpful tip</Text>
            </View>

            <Text style={styles.tipText}>
              Keep this app open and make sure your phone is not on silent.
            </Text>
          </View>

          {lastMessage ? (
            <View style={styles.statusCard}>
              <Ionicons name="chatbubble-ellipses" size={18} color={BRAND.blue} />
              <Text style={styles.statusText}>{lastMessage}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => setShowDebug((prev) => !prev)}
            style={({ pressed }) => [
              styles.debugToggle,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.debugToggleText}>
              {showDebug ? "Hide technical details" : "Show technical details"}
            </Text>
          </Pressable>

          {showDebug ? (
            <View style={styles.debugCard}>
              <View style={styles.debugHeaderRow}>
                <Text style={styles.debugTitle}>Technical Details</Text>

                <Pressable
                  onPress={refreshSecureStoreToken}
                  style={({ pressed }) => [styles.debugRefreshBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="refresh" size={14} color={BRAND.blue} />
                  <Text style={styles.debugRefreshText}>Check Token</Text>
                </Pressable>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>SecureStore auth_token</Text>
                <Text style={styles.debugValue}>{secureStoreTokenPreview}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Auth keys</Text>
                <Text style={styles.debugValue}>{authKeys.join(", ") || "(none)"}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Auth user snapshot</Text>
                <Text style={styles.debugMono}>{safeStringify(user ?? null)}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Button press count</Text>
                <Text style={styles.debugValue}>{String(buttonPressCount)}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Last request</Text>
                <Text style={styles.debugMono}>{safeStringify(lastRequestDebug)}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Last response</Text>
                <Text style={styles.debugMono}>{safeStringify(lastResponseDebug)}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Last error</Text>
                <Text style={styles.debugMono}>{safeStringify(lastErrorDebug)}</Text>
              </View>

              <View style={styles.debugBlock}>
                <Text style={styles.debugLabel}>Event log</Text>
                <Text style={styles.debugMono}>
                  {debugLines.length ? debugLines.join("\n") : "No debug events yet."}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleStartCall}
            disabled={isCalling}
            style={({ pressed }) => [
              styles.callBtn,
              pressed && !isCalling && styles.callBtnPressed,
              isCalling && styles.callBtnDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isCalling ? "Starting your call" : "Call me now"}
          >
            {isCalling ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.callBtnText}>Calling You…</Text>
              </>
            ) : (
              <>
                <Ionicons name="call" size={22} color="#FFFFFF" />
                <Text style={styles.callBtnText}>Call Me Now</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.footerNote}>
            Need help fast? Tap the button and keep your phone close.
          </Text>
        </View>
      </View>
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
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: 18,
  },

  headerRow: {
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignSelf: "flex-start",
  },

  backBtnPressed: {
    opacity: 0.85,
  },

  backText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 15,
  },

  content: {
    paddingTop: 6,
    paddingBottom: 24,
    gap: 16,
  },

  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    alignItems: "flex-start",
  },

  heroIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 14,
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 30,
    lineHeight: 36,
  },

  titleNarrow: {
    fontSize: 26,
    lineHeight: 32,
  },

  heroText: {
    marginTop: 12,
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 20,
    lineHeight: 28,
  },

  heroSubtext: {
    marginTop: 10,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 24,
  },

  reassuranceCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.greenBorder,
    backgroundColor: BRAND.greenSoft,
    padding: 18,
    gap: 10,
  },

  reassuranceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  reassuranceTitle: {
    color: BRAND.green,
    fontFamily: FONT.medium,
    fontSize: 17,
  },

  reassuranceText: {
    color: "#166534",
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 22,
  },

  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 14,
  },

  sectionTitle: {
    color: BRAND.text,
    fontFamily: FONT.medium,
    fontSize: 20,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  stepBadgeText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 15,
  },

  stepText: {
    flex: 1,
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 16,
    lineHeight: 22,
  },

  tipCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    padding: 18,
    gap: 10,
  },

  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  tipTitle: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 16,
  },

  tipText: {
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: 15,
    lineHeight: 22,
  },

  statusCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    backgroundColor: BRAND.blueSoft,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  statusText: {
    flex: 1,
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 15,
    lineHeight: 22,
  },

  debugToggle: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
  },

  debugToggleText: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: 13,
  },

  debugCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.debugBorder,
    backgroundColor: BRAND.debugBg,
    padding: 16,
    gap: 12,
  },

  debugHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  debugTitle: {
    color: BRAND.debugText,
    fontFamily: FONT.medium,
    fontSize: 18,
  },

  debugRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  debugRefreshText: {
    color: BRAND.blue,
    fontFamily: FONT.medium,
    fontSize: 12,
  },

  debugBlock: {
    gap: 6,
  },

  debugLabel: {
    color: BRAND.debugMuted,
    fontFamily: FONT.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  debugValue: {
    color: BRAND.debugText,
    fontFamily: FONT.regular,
    fontSize: 14,
    lineHeight: 20,
  },

  debugMono: {
    color: BRAND.debugText,
    fontFamily: FONT.regular,
    fontSize: 12,
    lineHeight: 18,
  },

  footer: {
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    backgroundColor: BRAND.screenBg,
    gap: 10,
  },

  callBtn: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: BRAND.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
  },

  callBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },

  callBtnDisabled: {
    opacity: 0.7,
  },

  callBtnText: {
    color: "#FFFFFF",
    fontFamily: FONT.medium,
    fontSize: 20,
    letterSpacing: 0.2,
  },

  footerNote: {
    textAlign: "center",
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
});