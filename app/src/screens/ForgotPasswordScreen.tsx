import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { postJson } from "../services/api/client";
import { FONT } from "../theme";

const BRAND = {
    pageBg: "#0B1220",
    screenBg: "#FFFFFF",
    border: "#D7DEE8",
    text: "#0B1220",
    muted: "#667085",
    blue: "#1E73E8",
    blueSoft: "#F3F7FF",
    blueBorder: "#D6E6FF",
    inputBg: "#FFFFFF",
    ok: "#039855",
    okSoft: "#ECFDF3",
};

const LOGO_URI =
    "https://res.cloudinary.com/djtsuktwb/image/upload/v1769703507/ChatGPT_Image_Jan_29_2026_08_00_07_AM_1_3_gtqeo8.jpg";

const H_PADDING = 18;
const LOGO_ASPECT_RATIO = 1.85;
const RESEND_COOLDOWN_SECONDS = 45;

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function norm(s: string) {
    return String(s || "").trim();
}

function normEmail(s: string) {
    return norm(s).toLowerCase();
}

function looksLikeEmail(email: string) {
    const e = normEmail(email);
    return /^\S+@\S+\.\S+$/.test(e);
}

function pickFriendlyResetMessage(status: number, json: any) {
    const raw = String(json?.error || json?.message || "").toLowerCase();

    if (status === 404) {
        return "We couldn’t find an account with that email.";
    }

    if (status === 422) {
        return "Please enter a valid email address.";
    }

    if (status === 429) {
        return "Too many attempts. Please wait a minute and try again.";
    }

    if (status >= 500) {
        return "Our server is having trouble right now. Please try again in a moment.";
    }

    if (status === 0) {
        return "We couldn’t reach the server. Please check your connection and try again.";
    }

    if (raw) return String(json?.error || json?.message);

    return "Something went wrong. Please try again.";
}

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [email, setEmail] = useState("");
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [resendCountdown, setResendCountdown] = useState(0);

    const fillAnim = useRef(new Animated.Value(0)).current;
    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
    });

    const iconAnim = useRef(new Animated.Value(0)).current;
    const iconX = iconAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 120],
    });

    useEffect(() => {
        const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
        const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        if (resendCountdown <= 0) return;

        const timer = setInterval(() => {
            setResendCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [resendCountdown]);

    const runAnim = () =>
        new Promise<void>((resolve) => {
            fillAnim.stopAnimation();
            iconAnim.stopAnimation();

            fillAnim.setValue(0);
            iconAnim.setValue(0);

            Animated.parallel([
                Animated.timing(fillAnim, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.timing(iconAnim, {
                    toValue: 1,
                    duration: 320,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => resolve());
        });

    const resetAnim = () =>
        new Promise<void>((resolve) => {
            fillAnim.stopAnimation();
            iconAnim.stopAnimation();

            Animated.parallel([
                Animated.timing(fillAnim, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.timing(iconAnim, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => resolve());
        });

    const sendReset = async ({ isResend = false }: { isResend?: boolean } = {}) => {
        if (isSubmitting) return;

        const em = normEmail(email);

        if (!em) {
            Alert.alert("Missing email", "Please enter your email address.");
            return;
        }

        if (!looksLikeEmail(em)) {
            Alert.alert("Check your email", "Please enter a valid email address.");
            return;
        }

        setIsSubmitting(true);

        if (!isResend) {
            setSuccessMessage("");
        }

        try {
            await sleep(60);
            await runAnim();

            const { ok, status, json } = await postJson("/v1/auth/forgot_password", {
                password_reset: {
                    email: em,
                },
            });

            if (!ok) {
                Alert.alert("Couldn’t send reset link", pickFriendlyResetMessage(status, json));
                return;
            }

            setSuccessMessage("Check your email for a reset link.");
            setResendCountdown(RESEND_COOLDOWN_SECONDS);
        } catch {
            Alert.alert(
                "Can’t connect",
                "We couldn’t reach the server right now. Please check your connection and try again."
            );
        } finally {
            setIsSubmitting(false);
            try {
                await resetAnim();
            } catch {}
        }
    };

    const handleSendReset = async () => {
        if (resendCountdown > 0) return;
        await sendReset({ isResend: false });
    };

    const handleResend = async () => {
        if (isSubmitting || resendCountdown > 0) return;
        await sendReset({ isResend: true });
    };

    const goBackToSignIn = () => {
        if (isSubmitting) return;
        router.replace("/(auth)/sign-in");
    };

    return (
        <SafeAreaView style={styles.page}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <View
                    style={[
                        styles.logoBannerFullBleed,
                        { paddingTop: Math.max(insets.top, 10) + (Platform.OS === "android" ? 8 : 0) },
                    ]}
                    pointerEvents="none"
                >
                    <Image source={{ uri: LOGO_URI }} style={styles.logoFullBleed} />
                </View>

                <View style={[styles.screen, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.main}>
                            <View style={styles.form}>
                                <Text style={styles.title}>Forgot Password</Text>
                                <Text style={styles.subtitle}>
                                    Enter your email and we’ll send you a reset link
                                </Text>

                                {!!successMessage && (
                                    <View style={styles.successBox}>
                                        <View style={styles.successLeft}>
                                            <Ionicons name="checkmark-circle" size={20} color={BRAND.ok} />
                                            <Text style={styles.successText}>{successMessage}</Text>
                                        </View>

                                        <Pressable
                                            onPress={handleResend}
                                            disabled={isSubmitting || resendCountdown > 0}
                                            hitSlop={8}
                                            style={({ pressed }) => [
                                                styles.resendPill,
                                                (isSubmitting || resendCountdown > 0) && styles.resendPillDisabled,
                                                pressed && !(isSubmitting || resendCountdown > 0)
                                                    ? { opacity: 0.85 }
                                                    : null,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.resendText,
                                                    (isSubmitting || resendCountdown > 0) && styles.resendTextDisabled,
                                                ]}
                                            >
                                                {resendCountdown > 0
                                                    ? `Resend in ${resendCountdown}s`
                                                    : "Resend link"}
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}

                                <View style={styles.field}>
                                    <Text style={styles.label}>Email</Text>
                                    <View style={styles.inputRow}>
                                        <Ionicons name="mail" size={22} color={BRAND.blue} />
                                        <TextInput
                                            value={email}
                                            onChangeText={(t) => {
                                                setEmail(t);
                                                if (successMessage) {
                                                    setSuccessMessage("");
                                                    setResendCountdown(0);
                                                }
                                            }}
                                            placeholder="you@example.com"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            autoComplete="off"
                                            textContentType="none"
                                            keyboardType="email-address"
                                            style={styles.input}
                                            editable={!isSubmitting}
                                            returnKeyType="go"
                                            onSubmitEditing={handleSendReset}
                                        />
                                    </View>
                                </View>

                                <Pressable
                                    onPress={handleSendReset}
                                    disabled={isSubmitting || resendCountdown > 0}
                                    style={({ pressed }) => [
                                        styles.primaryBtn,
                                        pressed && !(isSubmitting || resendCountdown > 0)
                                            ? { opacity: 0.9 }
                                            : null,
                                        isSubmitting || resendCountdown > 0 ? { opacity: 0.35 } : null,
                                    ]}
                                >
                                    <Animated.View
                                        pointerEvents="none"
                                        style={[
                                            styles.primaryFill,
                                            { width: fillWidth, opacity: isSubmitting ? 0.95 : 0 },
                                        ]}
                                    />
                                    <View style={styles.primaryInner} pointerEvents="none">
                                        {isSubmitting ? (
                                            <Animated.View style={{ transform: [{ translateX: iconX }] }}>
                                                <Ionicons name="mail-open" size={22} color="#FFFFFF" />
                                            </Animated.View>
                                        ) : (
                                            <>
                                                <Ionicons name="mail-open" size={22} color={BRAND.blue} />
                                                <Text style={styles.primaryText}>
                                                    {resendCountdown > 0
                                                        ? `SEND RESET LINK`
                                                        : "SEND RESET LINK"}
                                                </Text>
                                                <Ionicons
                                                    name="chevron-forward"
                                                    size={18}
                                                    color={BRAND.blue}
                                                    style={{ opacity: resendCountdown > 0 ? 0.2 : 0.7 }}
                                                />
                                            </>
                                        )}
                                    </View>
                                </Pressable>
                            </View>

                            <View style={styles.backRow}>
                                <Text style={styles.backText}>Remembered your password?</Text>
                                <Pressable onPress={goBackToSignIn} disabled={isSubmitting} hitSlop={10}>
                                    <Text style={styles.backLink}>Sign In</Text>
                                </Pressable>
                            </View>

                            <View style={{ height: 18 }} />
                        </View>
                    </ScrollView>

                    {!keyboardOpen && (
                        <View style={styles.footer}>
                            <Ionicons name="shield-checkmark" size={22} color={BRAND.blue} />
                            <Text style={styles.footerText}>
                                Mom&apos;s Scam Helpline{"\n"}Since 2<Text style={styles.footerZero}>0</Text>13
                            </Text>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: BRAND.pageBg },

    logoBannerFullBleed: {
        width: "100%",
        backgroundColor: "#FFFFFF",
        aspectRatio: LOGO_ASPECT_RATIO,
        overflow: "hidden",
    },

    logoFullBleed: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },

    screen: {
        flex: 1,
        backgroundColor: BRAND.screenBg,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        paddingHorizontal: H_PADDING,
        marginTop: -14,
    },

    scrollContent: { flexGrow: 1, justifyContent: "center" },
    main: { width: "100%" },

    form: {
        borderWidth: 1,
        borderColor: BRAND.border,
        borderRadius: 22,
        padding: 18,
    },

    title: { fontSize: 26, fontFamily: FONT.semi, color: BRAND.text },

    subtitle: {
        color: BRAND.muted,
        marginTop: 4,
        marginBottom: 12,
        fontFamily: FONT.regular,
    },

    field: { marginTop: 12 },
    label: { fontSize: 13, fontFamily: FONT.medium, color: BRAND.text },

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
        marginTop: 8,
    },

    input: {
        flex: 1,
        fontSize: 16,
        color: BRAND.text,
        fontFamily: FONT.regular,
        paddingVertical: 0,
    },

    successBox: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: 12,
        borderRadius: 14,
        backgroundColor: BRAND.okSoft,
        borderWidth: 1,
        borderColor: "#D1FADF",
        marginBottom: 10,
    },

    successLeft: {
        flex: 1,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
    },

    successText: {
        flex: 1,
        color: BRAND.ok,
        fontFamily: FONT.medium,
        fontSize: 14,
        lineHeight: 18,
    },

    resendPill: {
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#B7E4C7",
        alignSelf: "center",
    },

    resendPillDisabled: {
        backgroundColor: "#F4F6F8",
        borderColor: "#D7DEE8",
    },

    resendText: {
        color: BRAND.ok,
        fontFamily: FONT.medium,
        fontSize: 13,
    },

    resendTextDisabled: {
        color: BRAND.muted,
    },

    primaryBtn: {
        marginTop: 16,
        borderRadius: 999,
        backgroundColor: BRAND.blueSoft,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: BRAND.blueBorder,
    },

    primaryFill: {
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        backgroundColor: BRAND.blue,
        opacity: 0.95,
    },

    primaryInner: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 10,
    },

    primaryText: {
        fontFamily: FONT.medium,
        fontSize: 16,
        letterSpacing: 1,
        color: BRAND.text,
    },

    backRow: {
        marginTop: 14,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },

    backText: {
        fontSize: 14,
        color: BRAND.muted,
        fontFamily: FONT.regular,
    },

    backLink: {
        color: BRAND.blue,
        fontFamily: FONT.medium,
        fontSize: 14,
    },

    footer: {
        alignItems: "center",
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: "#EEF2F7",
        gap: 4,
    },

    footerText: {
        fontSize: 14,
        color: BRAND.muted,
        fontFamily: FONT.regular,
        textAlign: "center",
    },

    footerZero: {
        fontFamily: Platform.select({
            ios: "System",
            android: "sans-serif",
        }),
    },
});