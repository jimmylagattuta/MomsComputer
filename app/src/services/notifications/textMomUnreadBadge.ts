// app/services/notifications/textMomUnreadBadge.ts
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { getJson } from "../api/client";

const TEXT_MOM_UNREAD_COUNT_KEY = "text_mom_unread_count";

type Listener = (count: number) => void;

const listeners = new Set<Listener>();

function safeCount(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function isSupportUserFromStoredAuth(authUser: any): boolean {
  return (
    authUser?.role === "admin" ||
    authUser?.role === "super_admin" ||
    authUser?.admin === true ||
    authUser?.is_admin === true
  );
}

async function getStoredAuthUser(): Promise<any | null> {
  try {
    const raw = await SecureStore.getItemAsync("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.log("❌ [TextMomBadge] failed to read auth_user:", error);
    return null;
  }
}

async function setPhoneAppIconBadge(count: number): Promise<void> {
  const nextCount = safeCount(count);

  try {
    const ok = await Notifications.setBadgeCountAsync(nextCount);

    console.log("✅ [TextMomBadge] phone app icon badge set:", nextCount);
    console.log("✅ [TextMomBadge] phone app icon badge result:", ok);
  } catch (error) {
    console.log("❌ [TextMomBadge] failed to set phone app icon badge:", error);
  }
}

function normalizeUserUnreadCount(data: any): number {
  console.log("🧪 [TextMomBadge] normalizeUserUnreadCount raw data:", data);

  const directCount =
    data?.text_mom_unread_count ??
    data?.unread_count ??
    data?.thread?.text_mom_unread_count ??
    data?.thread?.unread_count ??
    data?.support_text_thread?.text_mom_unread_count ??
    data?.support_text_thread?.unread_count;

  console.log("🧪 [TextMomBadge] user directCount candidate:", directCount);

  if (directCount !== undefined && directCount !== null) {
    const normalizedDirectCount = safeCount(directCount);

    console.log(
      "🧪 [TextMomBadge] using user direct count:",
      normalizedDirectCount
    );

    return normalizedDirectCount;
  }

  const userUnread =
    data?.user_unread ??
    data?.thread?.user_unread ??
    data?.support_text_thread?.user_unread;

  console.log("🧪 [TextMomBadge] userUnread candidate:", userUnread);

  const normalizedBooleanCount = userUnread === true ? 1 : 0;

  console.log(
    "🧪 [TextMomBadge] using user boolean-derived count:",
    normalizedBooleanCount
  );

  return normalizedBooleanCount;
}

function normalizeAdminUnreadCount(data: any): number {
  console.log("🧪 [TextMomBadge] normalizeAdminUnreadCount raw data:", data);

  const directCount =
    data?.text_mom_unread_count ??
    data?.support_unread_count ??
    data?.unread_count ??
    data?.thread?.text_mom_unread_count ??
    data?.thread?.support_unread_count ??
    data?.thread?.unread_count;

  console.log("🧪 [TextMomBadge] admin directCount candidate:", directCount);

  if (directCount !== undefined && directCount !== null) {
    const normalizedDirectCount = safeCount(directCount);

    console.log(
      "🧪 [TextMomBadge] using admin direct count:",
      normalizedDirectCount
    );

    return normalizedDirectCount;
  }

  const threads = Array.isArray(data?.threads)
    ? data.threads
    : Array.isArray(data)
      ? data
      : [];

  console.log("🧪 [TextMomBadge] admin threads count:", threads.length);

  if (threads.length > 0) {
    const total = threads.reduce((sum: number, thread: any) => {
      const threadCount =
        thread?.text_mom_unread_count ??
        thread?.support_unread_count ??
        thread?.unread_count;

      if (threadCount !== undefined && threadCount !== null) {
        return sum + safeCount(threadCount);
      }

      return sum + (thread?.support_unread === true ? 1 : 0);
    }, 0);

    const normalizedThreadTotal = safeCount(total);

    console.log(
      "🧪 [TextMomBadge] using admin thread-derived total:",
      normalizedThreadTotal
    );

    return normalizedThreadTotal;
  }

  const supportUnread =
    data?.support_unread ??
    data?.thread?.support_unread ??
    data?.support_text_thread?.support_unread;

  console.log("🧪 [TextMomBadge] supportUnread candidate:", supportUnread);

  const normalizedBooleanCount = supportUnread === true ? 1 : 0;

  console.log(
    "🧪 [TextMomBadge] using admin boolean-derived count:",
    normalizedBooleanCount
  );

  return normalizedBooleanCount;
}

function emit(count: number) {
  console.log("🧪 [TextMomBadge] emitting count to listeners:", count);
  console.log("🧪 [TextMomBadge] listener count:", listeners.size);

  listeners.forEach((listener) => {
    try {
      listener(count);
    } catch (error) {
      console.log("❌ [TextMomBadge] listener error:", error);
    }
  });
}

export async function getTextMomUnreadCount(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(TEXT_MOM_UNREAD_COUNT_KEY);
    const count = safeCount(raw || 0);

    console.log("🧪 [TextMomBadge] get stored count raw:", raw);
    console.log("🧪 [TextMomBadge] get stored count normalized:", count);

    return count;
  } catch (error) {
    console.log("❌ [TextMomBadge] failed to read stored count:", error);
    return 0;
  }
}

export async function setTextMomUnreadCount(count: number): Promise<number> {
  const nextCount = safeCount(count);

  console.log("🧪 [TextMomBadge] set count requested:", count);
  console.log("🧪 [TextMomBadge] set count normalized:", nextCount);

  try {
    await SecureStore.setItemAsync(
      TEXT_MOM_UNREAD_COUNT_KEY,
      String(nextCount)
    );

    console.log("✅ [TextMomBadge] stored count:", nextCount);
  } catch (error) {
    console.log("❌ [TextMomBadge] failed to store count:", error);
  }

  await setPhoneAppIconBadge(nextCount);

  emit(nextCount);
  return nextCount;
}

export async function incrementTextMomUnreadCount(amount = 1): Promise<number> {
  console.log("🧪 [TextMomBadge] increment requested amount:", amount);

  const current = await getTextMomUnreadCount();
  const next = current + amount;

  console.log("🧪 [TextMomBadge] increment current:", current);
  console.log("🧪 [TextMomBadge] increment next:", next);

  return setTextMomUnreadCount(next);
}

export async function clearTextMomUnreadCount(): Promise<number> {
  console.log("🧪 [TextMomBadge] clear requested");
  return setTextMomUnreadCount(0);
}

export async function refreshTextMomUnreadCountFromServer(): Promise<number> {
  console.log("🧪 [TextMomBadge] refresh from server started");

  try {
    const token = await SecureStore.getItemAsync("auth_token");

    console.log("🧪 [TextMomBadge] auth token exists:", !!token);

    if (!token) {
      console.log("⚠️ [TextMomBadge] no auth token; setting count to 0");
      return setTextMomUnreadCount(0);
    }

    const authUser = await getStoredAuthUser();
    const isSupportUser = isSupportUserFromStoredAuth(authUser);

    console.log("🧪 [TextMomBadge] auth user:", authUser);
    console.log("🧪 [TextMomBadge] is support user:", isSupportUser);

    const endpoint = isSupportUser
      ? "/v1/support/text_threads"
      : "/v1/support_text_thread";

    console.log("🧪 [TextMomBadge] calling GET", endpoint);

    const res = await getJson(endpoint, token);

    console.log("🧪 [TextMomBadge] server response ok:", res.ok);
    console.log("🧪 [TextMomBadge] server response status:", res.status);
    console.log("🧪 [TextMomBadge] server response json:", res.json);

    if (!res.ok) {
      console.log(
        "❌ [TextMomBadge] failed to refresh Text Mom unread badge",
        res.status,
        res.json
      );

      const fallbackCount = await getTextMomUnreadCount();

      console.log(
        "🧪 [TextMomBadge] returning fallback stored count:",
        fallbackCount
      );

      return fallbackCount;
    }

    const count = isSupportUser
      ? normalizeAdminUnreadCount(res.json)
      : normalizeUserUnreadCount(res.json);

    console.log("🧪 [TextMomBadge] normalized server count:", count);

    const storedCount = await setTextMomUnreadCount(count);

    console.log("✅ [TextMomBadge] refresh complete count:", storedCount);

    return storedCount;
  } catch (error) {
    console.log("❌ [TextMomBadge] refresh error:", error);

    const fallbackCount = await getTextMomUnreadCount();

    console.log(
      "🧪 [TextMomBadge] returning fallback stored count after error:",
      fallbackCount
    );

    return fallbackCount;
  }
}

export function subscribeToTextMomUnreadCount(listener: Listener) {
  console.log("🧪 [TextMomBadge] subscribe listener");

  listeners.add(listener);

  console.log(
    "🧪 [TextMomBadge] listener count after subscribe:",
    listeners.size
  );

  return () => {
    console.log("🧪 [TextMomBadge] unsubscribe listener");

    listeners.delete(listener);

    console.log(
      "🧪 [TextMomBadge] listener count after unsubscribe:",
      listeners.size
    );
  };
}