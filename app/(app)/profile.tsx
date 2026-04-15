import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth/AuthProvider";
import { FONT } from "../src/theme";

const IS_ANDROID = Platform.OS === "android";

const BRAND = {
  pageBg: "#0B1220",
  screenBg: "#FFFFFF",
  border: "#D7DEE8",
  softBorder: "#E8EEF7",
  text: "#0B1220",
  muted: "#667085",
  blue: "#1E73E8",
  blueSoft: "#F3F7FF",
  blueBorder: "#D6E6FF",
  green: "#137A4B",
  greenSoft: "#ECFDF3",
  greenBorder: "#CDEFD9",
  amber: "#B7791F",
  amberSoft: "#FFF8E7",
  amberBorder: "#F4E2B8",
  red: "#C62828",
  redSoft: "#FFF5F5",
  redBorder: "#FFD9D9",
  grayChipBg: "#F8FAFC",
  grayChipBorder: "#E2E8F0",
  grayChipText: "#64748B",
};

function formatValue(value: any, fallback = "Not provided") {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str.length ? str : fallback;
}

function titleize(value: any, fallback = "Not provided") {
  const str = formatValue(value, "");
  if (!str) return fallback;

  return str
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatBoolean(value: any) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not provided";
}

function formatTimezone(value: any) {
  const str = formatValue(value, "");
  if (!str) return "Not provided";

  const friendlyMap: Record<string, string> = {
    "America/Los_Angeles": "Pacific Time",
    "America/New_York": "Eastern Time",
    "America/Chicago": "Central Time",
    "America/Denver": "Mountain Time",
    "America/Boise": "Mountain Time",
    "America/Phoenix": "Arizona Time",
    "America/Anchorage": "Alaska Time",
    "Pacific/Honolulu": "Hawaii Time",
  };

  if (friendlyMap[str]) return friendlyMap[str];

  return str
    .split("/")
    .map((part: string) => part.replace(/_/g, " "))
    .join(" / ");
}

function formatDateTime(value: any) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

function formatDateOnly(value: any) {
  if (!value) return "Not provided";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

function getInitials(fullName: string) {
  const parts = fullName
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function ProfileChip({
  label,
  tone = "blue",
}: {
  label: string;
  tone?: "blue" | "green" | "amber" | "red" | "muted";
}) {
  const toneStyles =
    tone === "green"
      ? {
          wrap: styles.chipGreen,
          text: styles.chipGreenText,
        }
      : tone === "amber"
        ? {
            wrap: styles.chipAmber,
            text: styles.chipAmberText,
          }
        : tone === "red"
          ? {
              wrap: styles.chipRed,
              text: styles.chipRedText,
            }
          : tone === "muted"
            ? {
                wrap: styles.chipMuted,
                text: styles.chipMutedText,
              }
            : {
                wrap: styles.chipBlue,
                text: styles.chipBlueText,
              };

  return (
    <View style={[styles.chip, toneStyles.wrap]}>
      <Text style={[styles.chipText, toneStyles.text]}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionStack}>{children}</View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneColor =
    tone === "success"
      ? BRAND.green
      : tone === "warning"
        ? BRAND.amber
        : tone === "danger"
          ? BRAND.red
          : BRAND.blue;

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={20} color={toneColor} />
      </View>

      <View style={styles.infoTextWrap}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const auth = useAuth() as any;
  const user = auth?.user ?? {};

  const firstName = user?.first_name || user?.firstName || "";
  const lastName = user?.last_name || user?.lastName || "";
  const preferredName = user?.preferred_name || user?.preferredName || "";
  const email = user?.email || "";
  const phone = user?.phone || "";
  const preferredLanguage =
    user?.preferred_language || user?.preferredLanguage || "";
  const timezone = user?.timezone || "";
  const role = user?.role || "";
  const status = user?.status || "";
  const marketingOptIn = user?.marketing_opt_in;
  const createdAt = user?.created_at || user?.createdAt;
  const updatedAt = user?.updated_at || user?.updatedAt;
  const lastLoginAt = user?.last_login_at || user?.lastLoginAt;
  const lastSeenAt = user?.last_seen_at || user?.lastSeenAt;
  const dateOfBirth = user?.date_of_birth || user?.dateOfBirth;
  const phoneVerifiedAt =
    user?.phone_verified_at || user?.phoneVerifiedAt || null;

  const fullName =
    `${firstName} ${lastName}`.trim() ||
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    "User";

  const initials = getInitials(fullName);

  const statusLabel = titleize(status, "Unknown");
  const roleLabel = titleize(role, "User");
  const phoneVerifiedLabel = phoneVerifiedAt
    ? "Phone Verified"
    : "Phone Not Verified";

  const statusTone =
    String(status).toLowerCase() === "active"
      ? "green"
      : String(status).toLowerCase() === "pending"
        ? "amber"
        : String(status).length
          ? "red"
          : "blue";

  return (
    <SafeAreaView style={styles.page} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backBtnPressed,
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={BRAND.blue} />
          </Pressable>

          <Text style={styles.title}>Profile</Text>

          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </View>

            <Text style={styles.heroName}>{fullName}</Text>
            <Text style={styles.heroSub}>
              {formatValue(email, "No email found")}
            </Text>

            <View style={styles.chipsRow}>
              <ProfileChip label={statusLabel} tone={statusTone} />
              <ProfileChip label={roleLabel} tone="muted" />
              <ProfileChip
                label={phoneVerifiedLabel}
                tone={phoneVerifiedAt ? "green" : "amber"}
              />
            </View>
          </View>

          <Section title="Account Details">
            <InfoRow
              icon="person-outline"
              label="Full Name"
              value={formatValue(fullName)}
            />
            <InfoRow
              icon="happy-outline"
              label="Preferred Name"
              value={formatValue(preferredName)}
            />
            <InfoRow
              icon="mail-outline"
              label="Email"
              value={formatValue(email)}
            />
            <InfoRow
              icon="call-outline"
              label="Phone"
              value={formatValue(phone)}
            />
            <InfoRow
              icon="calendar-outline"
              label="Date of Birth"
              value={formatDateOnly(dateOfBirth)}
            />
          </Section>

          <Section title="Preferences">
            <InfoRow
              icon="language-outline"
              label="Preferred Language"
              value={formatValue(preferredLanguage)}
            />
            <InfoRow
              icon="earth-outline"
              label="Timezone"
              value={formatTimezone(timezone)}
            />
            <InfoRow
              icon="megaphone-outline"
              label="Marketing Opt-In"
              value={formatBoolean(marketingOptIn)}
              tone={marketingOptIn ? "success" : "warning"}
            />
          </Section>

          <Section title="Activity">
            <InfoRow
              icon="shield-checkmark-outline"
              label="Status"
              value={statusLabel}
              tone={
                statusTone === "green"
                  ? "success"
                  : statusTone === "amber"
                    ? "warning"
                    : statusTone === "red"
                      ? "danger"
                      : "default"
              }
            />
            <InfoRow
              icon="briefcase-outline"
              label="Role"
              value={roleLabel}
            />
            <InfoRow
              icon="checkmark-done-outline"
              label="Phone Verification"
              value={phoneVerifiedLabel}
              tone={phoneVerifiedAt ? "success" : "warning"}
            />
            <InfoRow
              icon="time-outline"
              label="Member Since"
              value={formatDateTime(createdAt)}
            />
            <InfoRow
              icon="log-in-outline"
              label="Last Login"
              value={formatDateTime(lastLoginAt)}
            />
            <InfoRow
              icon="eye-outline"
              label="Last Seen"
              value={formatDateTime(lastSeenAt)}
            />
            <InfoRow
              icon="create-outline"
              label="Last Updated"
              value={formatDateTime(updatedAt)}
            />
          </Section>
        </ScrollView>
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
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },

  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
  },

  backBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  title: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 20 : 22,
    letterSpacing: 0.3,
  },

  topBarSpacer: {
    width: 48,
    height: 48,
  },

  scrollContent: {
    paddingTop: 6,
    paddingBottom: 32,
  },

  heroCard: {
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 28,
    backgroundColor: BRAND.blueSoft,
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    alignItems: "center",
  },

  avatarOuter: {
    width: 94,
    height: 94,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BRAND.blueBorder,
    marginBottom: 12,
  },

  avatarInner: {
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.blue,
  },

  avatarInitials: {
    color: "#FFFFFF",
    fontFamily: FONT.semi,
    fontSize: 28,
    letterSpacing: 0.6,
  },

  heroName: {
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 24 : 27,
    textAlign: "center",
  },

  heroSub: {
    marginTop: 6,
    color: BRAND.muted,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 13 : 14,
    textAlign: "center",
  },

  chipsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },

  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },

  chipText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  chipBlue: {
    backgroundColor: "#FFFFFF",
    borderColor: BRAND.blueBorder,
  },

  chipBlueText: {
    color: BRAND.blue,
  },

  chipGreen: {
    backgroundColor: BRAND.greenSoft,
    borderColor: BRAND.greenBorder,
  },

  chipGreenText: {
    color: BRAND.green,
  },

  chipAmber: {
    backgroundColor: BRAND.amberSoft,
    borderColor: BRAND.amberBorder,
  },

  chipAmberText: {
    color: BRAND.amber,
  },

  chipRed: {
    backgroundColor: BRAND.redSoft,
    borderColor: BRAND.redBorder,
  },

  chipRedText: {
    color: BRAND.red,
  },

  chipMuted: {
    backgroundColor: BRAND.grayChipBg,
    borderColor: BRAND.grayChipBorder,
  },

  chipMutedText: {
    color: BRAND.grayChipText,
  },

  section: {
    marginTop: 20,
  },

  sectionTitle: {
    marginBottom: 12,
    color: BRAND.text,
    fontFamily: FONT.semi,
    fontSize: IS_ANDROID ? 17 : 18,
    letterSpacing: 0.2,
  },

  sectionStack: {
    gap: 10,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: "#FFFFFF",
  },

  infoIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: BRAND.softBorder,
  },

  infoTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  infoLabel: {
    color: BRAND.muted,
    fontFamily: FONT.medium,
    fontSize: IS_ANDROID ? 12 : 13,
    marginBottom: 4,
  },

  infoValue: {
    color: BRAND.text,
    fontFamily: FONT.regular,
    fontSize: IS_ANDROID ? 15 : 16,
    lineHeight: IS_ANDROID ? 20 : 22,
  },
});