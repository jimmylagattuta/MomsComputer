// app/src/screens/PublicAskMom/PublicAskMomScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AskMomHeader from "../AskMom/components/AskMomHeader";
import ChatComposer, { ComposerImage } from "../AskMom/components/ChatComposer";
import ChatMessageRow from "../AskMom/components/ChatMessageRow";
import HomeFooterButton from "../AskMom/components/HomeFooterButton";
import type { ChatMessage } from "../AskMom/components/types";
import { BRAND, H_PADDING } from "../AskMom/theme";

import { PublicAskMomResponse, publicAskMom } from "../../services/api/publicAskMom";
import { getOrCreatePublicAskMomGuestId } from "../../services/publicAskMomStorage/publicAskMomGuestIdentity";
import {
  clearPublicAskMomChat,
  loadPublicAskMomChat,
  savePublicAskMomChat,
} from "../../services/publicAskMomStorage/publicAskMomLocalChat";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatAssistantText(summary: string, steps: string[]) {
  const lines: string[] = [];
  if (summary) lines.push(summary.trim());
  if (steps?.length) {
    lines.push("");
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

const THINKING_OPTIONS = ["One sec, I’m looking into it"];

function pickThinkingText() {
  return THINKING_OPTIONS[Math.floor(Math.random() * THINKING_OPTIONS.length)];
}

const PRECHAT_OPENER =
  "I’m here with you. Take your time and tell me what you’re seeing.";

const MAX_IMAGES = 1;

async function ensureJpegUri(uri: string) {
  const lower = (uri || "").toLowerCase();

  const looksLikeJpegOrPng =
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.includes("image/jpg") ||
    lower.includes("image/jpeg") ||
    lower.includes("image/png");

  const looksLikeHeic =
    lower.endsWith(".heic") ||
    lower.endsWith(".heif") ||
    lower.includes("image/heic") ||
    lower.includes("image/heif");

  if (looksLikeJpegOrPng && !looksLikeHeic) return uri;

  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return result.uri;
}

export default function PublicAskMomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView | null>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const prechatSeededRef = useRef(false);

  // ✅ Android first-keyboard-open layout helper.
  // This prevents repeated first-open corrections while staying on the same chat.
  const firstAndroidKeyboardFixDoneRef = useRef(false);

  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestBooting, setGuestBooting] = useState(true);
  const [localChatLoaded, setLocalChatLoaded] = useState(false);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastLimits, setLastLimits] = useState<PublicAskMomResponse["limits"] | null>(null);

  const [composerImages, setComposerImages] = useState<ComposerImage[]>([]);

  const hasConversation = messages.length > 0;

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const kbHeight = useRef(new Animated.Value(0)).current;

  const [keyboardLift, setKeyboardLift] = useState(0);
  const [bottomStackHeight, setBottomStackHeight] = useState(0);

  // ✅ Idea 3B:
  // This state triggers recalculation/timed scroll effects WITHOUT remounting
  // the ChatComposer/TextInput. Do NOT use this as a key on Animated.View.
  const [androidLayoutTick, setAndroidLayoutTick] = useState(0);

  const animateKb = (to: number, duration = 220) => {
    Animated.timing(kbHeight, {
      toValue: to,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated });
    });
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const saved = await loadPublicAskMomChat();

        if (!mounted) return;

        if (saved?.messages?.length) {
          prechatSeededRef.current = true;
          setMessages(saved.messages);
        }

        if (saved?.last_limits) {
          setLastLimits(saved.last_limits);
        }
      } catch (e: any) {
        console.log("PUBLIC ASK MOM LOCAL CHAT LOAD FAILED", e);
      } finally {
        if (mounted) {
          setLocalChatLoaded(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const id = await getOrCreatePublicAskMomGuestId();

        if (!mounted) return;
        setGuestId(id);
      } catch (e: any) {
        console.log("PUBLIC ASK MOM GUEST ID FAILED", e);

        if (!mounted) return;
        Alert.alert(
          "Couldn’t start Ask Mom",
          "Please close and reopen the app, then try again."
        );
      } finally {
        if (mounted) {
          setGuestBooting(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!localChatLoaded) return;
    if (guestBooting) return;

    savePublicAskMomChat({
      messages,
      last_limits: lastLimits,
    }).catch((e) => {
      console.log("PUBLIC ASK MOM LOCAL CHAT SAVE FAILED", e);
    });
  }, [messages, lastLimits, localChatLoaded, guestBooting]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent as any, (e: any) => {
      const rawH = Math.max(0, e?.endCoordinates?.height || 0);

      const iosLift = Math.max(0, rawH - insets.bottom);

      // ✅ Keep Android in native resize mode.
      // The fix here is timing/layout recalculation, not manual lifting.
      const androidLift = 0;

      const lift = Platform.OS === "ios" ? iosLift : androidLift;

      setKeyboardOpen(true);
      setKeyboardLift(lift);
      animateKb(lift, Platform.OS === "ios" ? 220 : 160);

      if (Platform.OS === "android" && !firstAndroidKeyboardFixDoneRef.current) {
        firstAndroidKeyboardFixDoneRef.current = true;

        requestAnimationFrame(() => {
          setAndroidLayoutTick((prev) => prev + 1);
          scrollToBottom(false);
        });

        setTimeout(() => {
          setAndroidLayoutTick((prev) => prev + 1);
          scrollToBottom(false);
        }, 80);

        setTimeout(() => {
          setAndroidLayoutTick((prev) => prev + 1);
          scrollToBottom(false);
        }, 180);

        setTimeout(() => {
          setAndroidLayoutTick((prev) => prev + 1);
          scrollToBottom(false);
        }, 320);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardOpen(false);
      setKeyboardLift(0);
      animateKb(0, Platform.OS === "ios" ? 220 : 140);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [kbHeight, insets.bottom]);

  useEffect(() => {
    if (!keyboardOpen) return;

    scrollToBottom(false);
    const t1 = setTimeout(() => scrollToBottom(false), 50);
    const t2 = setTimeout(() => scrollToBottom(false), 140);
    const t3 = setTimeout(() => scrollToBottom(false), 260);
    const t4 = setTimeout(() => scrollToBottom(false), 420);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [keyboardOpen, keyboardLift, bottomStackHeight, androidLayoutTick]);

  useEffect(() => {
    if (!localChatLoaded) return;
    if (prechatSeededRef.current) return;

    const isFreshThread = messages.length === 0 && !loading && !guestBooting;
    if (!isFreshThread) return;

    prechatSeededRef.current = true;

    const openerMsg: ChatMessage = {
      id: uid(),
      role: "assistant",
      text: PRECHAT_OPENER,
      pending: false,
    };

    setMessages([openerMsg]);
  }, [messages.length, loading, guestBooting, localChatLoaded]);

  const startThinkingAnimation = (thinkingId: string, base: string) => {
    let dots = 0;

    thinkingIntervalRef.current = setInterval(() => {
      dots = dots === 3 ? 0 : dots + 1;
      const t = `${base}${".".repeat(dots)}`;

      setMessages((prev) =>
        prev.map((m) => (m.id === thinkingId ? { ...m, text: t } : m))
      );
    }, 260);
  };

  const stopThinkingAnimation = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
  };

  const handleImageLoaded = (uri: string) => {
    setComposerImages((prev) =>
      prev.map((im) => (im.uri === uri ? { ...im, loading: false } : im))
    );
  };

  const addImagesToComposer = async (inputUris: string[]) => {
    const convertedUris: string[] = [];

    for (const u of inputUris) {
      try {
        const jpegUri = await ensureJpegUri(u);
        convertedUris.push(jpegUri);
      } catch (err) {
        console.log("PUBLIC IMAGE CONVERT FAILED", u, err);
        convertedUris.push(u);
      }
    }

    const picked: ComposerImage[] = convertedUris.map((uri) => ({
      uri,
      loading: true,
    }));

    setComposerImages((prev) => {
      const merged = [...prev];

      for (const img of picked) {
        if (merged.some((m) => m.uri === img.uri)) continue;
        if (merged.length >= MAX_IMAGES) break;
        merged.push(img);
      }

      return merged;
    });

    setTimeout(() => scrollToBottom(true), 30);
  };

  const handleOpenCamera = async () => {
    try {
      const remaining = Math.max(0, MAX_IMAGES - composerImages.length);
      if (remaining <= 0) {
        Alert.alert("Max 1 image", "Remove the screenshot to add another.");
        return;
      }

      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera access needed",
          "Please allow camera access to take a photo."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        cameraType: ImagePicker.CameraType.back,
      });

      if (result.canceled) return;

      const capturedUris = (result.assets || [])
        .map((a) => a?.uri)
        .filter(Boolean) as string[];

      if (!capturedUris.length) return;

      await addImagesToComposer(capturedUris);
    } catch (e: any) {
      console.log("PUBLIC CAMERA OPEN FAILED", e);
      Alert.alert("Couldn’t open camera", "Please try again.");
    }
  };

  const handleOpenPhotoLibrary = async () => {
    try {
      const remaining = Math.max(0, MAX_IMAGES - composerImages.length);
      if (remaining <= 0) {
        Alert.alert("Max 1 image", "Remove the screenshot to add another.");
        return;
      }

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Photo access needed",
          "Please allow photo library access to attach an image."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        selectionLimit: remaining,
        quality: 0.9,
      });

      if (result.canceled) return;

      const pickedUris = (result.assets || [])
        .map((a) => a?.uri)
        .filter(Boolean) as string[];

      if (!pickedUris.length) return;

      await addImagesToComposer(pickedUris);
    } catch (e: any) {
      console.log("PUBLIC IMAGE PICK FAILED", e);
      Alert.alert("Couldn’t open photos", "Please try again.");
    }
  };

  const handlePressAddImage = () => {
    const remaining = Math.max(0, MAX_IMAGES - composerImages.length);
    if (remaining <= 0) {
      Alert.alert("Max 1 image", "Remove the screenshot to add another.");
      return;
    }

    Alert.alert(
      "Add image",
      "Choose how you want to attach an image.",
      [
        { text: "Open Camera", onPress: handleOpenCamera },
        { text: "Choose from Photos", onPress: handleOpenPhotoLibrary },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const handleRemoveImage = (uri: string) => {
    setComposerImages((prev) => prev.filter((im) => im.uri !== uri));
  };

  const handleOpenHistoryUnavailable = () => {
    Alert.alert(
      "Create account for history",
      "Ask Mom works for free as a guest. Create an account only if you want to save and review your conversations later.",
      [
        { text: "Not Now", style: "cancel" },
        {
          text: "Create Account",
          onPress: () =>
            router.push({
              pathname: "/(auth)/sign-up",
              params: { intent: "more_ask_mom", feature: "Ask Mom History" },
            } as any),
        },
      ]
    );
  };

  const handleSend = async () => {
    const text = input.trim();

    if (!text && composerImages.length === 0) {
      Alert.alert(
        "Type a message",
        "Ask anything about what you’re seeing or what happened."
      );
      return;
    }

    if (!guestId) {
      Alert.alert("Still loading", "Please wait one second and try again.");
      return;
    }

    const imagesToSend = [...composerImages];

    Keyboard.dismiss();
    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      text: text || "(image)",
      images: imagesToSend.length ? imagesToSend : [],
    };

    setComposerImages([]);

    const thinkingId = uid();
    const thinkingBase = pickThinkingText();

    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "assistant",
      text: thinkingBase,
      pending: true,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setTimeout(() => scrollToBottom(true), 30);

    startThinkingAnimation(thinkingId, thinkingBase);

    try {
      const res = await publicAskMom(guestId, text, imagesToSend as any);

      if (res.limits) {
        setLastLimits(res.limits);
      }

      const assistantText = formatAssistantText(
        String(res.summary || ""),
        Array.isArray(res.steps) ? res.steps : []
      );

      stopThinkingAnimation();

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text:
                  assistantText ||
                  "I couldn’t read that clearly. Try typing what you see on the screen.",
                pending: false,
                show_contact_panel: false,
                escalation_reason: null,
                contact_actions: null,
                contact_draft: null,
                contact_targets: null,
              }
            : m
        )
      );
    } catch (e: any) {
      stopThinkingAnimation();

      const json = e?.json || {};

      if (json?.limits) {
        setLastLimits(json.limits);
      }

      const apiMessage =
        json?.message ||
        e?.message ||
        "I couldn’t reach the server right now. Please try again.";

      const isLimitError =
        json?.error === "daily_message_limit_reached" ||
        json?.error === "daily_image_limit_reached" ||
        json?.error === "daily_conversation_limit_reached" ||
        json?.error === "conversation_message_limit_reached";

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: isLimitError
                  ? `${apiMessage}\n\nCreate a free account to keep going.`
                  : `${apiMessage}\n\n(If this is urgent or involves money/codes, don’t proceed—tell me what it said.)`,
                pending: false,
              }
            : m
        )
      );

      if (isLimitError) {
        Alert.alert(
          "Free limit reached",
          `${apiMessage}\n\nCreate a free account to keep going.`,
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Sign In",
              onPress: () => router.push("/(auth)/sign-in" as any),
            },
            {
              text: "Create Free Account",
              onPress: () =>
                router.push({
                  pathname: "/(auth)/sign-up",
                  params: { intent: "more_ask_mom" },
                } as any),
            },
          ]
        );
      }
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom(true), 30);
    }
  };

  const handleClear = () => {
    clearPublicAskMomChat().catch((e) => {
      console.log("PUBLIC ASK MOM LOCAL CHAT CLEAR FAILED", e);
    });

    prechatSeededRef.current = false;
    firstAndroidKeyboardFixDoneRef.current = false;

    stopThinkingAnimation();
    Keyboard.dismiss();
    setInput("");
    setComposerImages([]);
    setLastLimits(null);
    setMessages([]);
    setLoading(false);
  };

  useEffect(() => {
    return () => stopThinkingAnimation();
  }, []);

  const footerSafePad =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 12) + 10
      : insets.bottom;

  const showHomeFooterButton = !keyboardOpen;

  const scrollBottomPad =
    bottomStackHeight +
    (Platform.OS === "ios" && keyboardOpen ? keyboardLift : 0) +
    8 +
    androidLayoutTick * 0;

  if (guestBooting || !localChatLoaded) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={[styles.screen, styles.bootScreen]}>
          <Ionicons name="chatbubble-ellipses" size={34} color={BRAND.blue} />
          <Text style={styles.bootTitle}>Starting Ask Mom…</Text>
          <Text style={styles.bootSub}>One sec, setting up your free guest chat.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page}>
      <View style={[styles.screen, { paddingTop: 25, paddingBottom: 0 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerCenter}>
            <AskMomHeader onOpenHistory={handleOpenHistoryUnavailable} />
          </View>

          <View style={styles.scamlineRight}>
            <Ionicons name="shield-checkmark" size={18} color={BRAND.blue} />
            <Text style={styles.scamlineText}>
              Mom&apos;s Scam{"\n"}Helpline Since{"\n"}2013
            </Text>
          </View>
        </View>

        <View style={styles.saveNotice}>
          <Ionicons name="information-circle-outline" size={16} color={BRAND.blue} />
          <Text style={styles.saveNoticeText}>
            Ask Mom chats are only saved after you create an account.
          </Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: scrollBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(true)}
        >
          {hasConversation ? (
            <View style={styles.conversation}>
              {messages.map((m, idx) => (
                <ChatMessageRow
                  key={m.id}
                  msg={m}
                  thread={messages}
                  index={idx}
                />
              ))}
            </View>
          ) : (
            <View style={{ height: 6 }} />
          )}
        </ScrollView>

        <Animated.View
          style={{
            transform: [
              {
                translateY: Animated.multiply(kbHeight, -1),
              },
            ],
          }}
        >
          <View
            onLayout={(e) => {
              const h = Math.max(0, e?.nativeEvent?.layout?.height || 0);
              if (h && Math.abs(h - bottomStackHeight) > 2) {
                setBottomStackHeight(h);
              }
            }}
          >
            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={handleSend}
              onClear={handleClear}
              disabled={loading || (!input.trim() && composerImages.length === 0)}
              loading={loading}
              hasConversation={hasConversation}
              messagesCount={messages.length}
              images={composerImages}
              onPressAddImage={handlePressAddImage}
              onRemoveImage={handleRemoveImage}
              onImageLoaded={handleImageLoaded}
            />

            {showHomeFooterButton ? (
              <View style={{ paddingBottom: footerSafePad }}>
                <HomeFooterButton onPress={() => router.replace("/" as any)} />
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BRAND.screenBg },

  screen: {
    flex: 1,
    backgroundColor: BRAND.screenBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BRAND.border,
    paddingHorizontal: H_PADDING,
  },

  bootScreen: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  bootTitle: {
    fontSize: 18,
    color: BRAND.text,
    fontWeight: "700",
    textAlign: "center",
  },

  bootSub: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: "center",
  },

  headerRow: {
    position: "relative",
    minHeight: 52,
    justifyContent: "center",
  },

  headerCenter: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  scamlineRight: {
    alignSelf: "center",
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },

  scamlineText: {
    fontSize: 11,
    color: BRAND.muted,
    textAlign: "center",
    lineHeight: 13,
  },

  saveNotice: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#F3F7FF",
    borderWidth: 1,
    borderColor: "#D6E6FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  saveNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: BRAND.muted,
    textAlign: "center",
  },

  momBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingBottom: 10,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },

  momBadgeText: {
    fontSize: 13,
    color: BRAND.muted,
    textAlign: "center",
  },

  momBadgeZero: {
    fontFamily: Platform.select({
      ios: "System",
      android: "sans-serif",
    }),
  },

  content: {
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },

  conversation: {
    paddingBottom: 2,
  },
});