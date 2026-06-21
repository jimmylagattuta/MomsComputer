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
    console.log("[TextMomBadge] failed to read auth_user:", error);
    return null;
  }
}

async function setPhoneAppIconBadge(count: number): Promise<void> {
  const nextCount = safeCount(count);

  try {
    await Notifications.setBadgeCountAsync(nextCount);
  } catch (error) {
    console.log("[TextMomBadge] failed to set phone app icon badge:", error);
  }
}

function normalizeUserUnreadCount(data: any): number {
  const directCount =
    data?.text_mom_unread_count ??
    data?.unread_count ??
    data?.thread?.text_mom_unread_count ??
    data?.thread?.unread_count ??
    data?.support_text_thread?.text_mom_unread_count ??
    data?.support_text_thread?.unread_count;

  if (directCount !== undefined && directCount !== null) {
    return safeCount(directCount);
  }

  const userUnread =
    data?.user_unread ??
    data?.thread?.user_unread ??
    data?.support_text_thread?.user_unread;

  return userUnread === true ? 1 : 0;
}

function normalizeAdminUnreadCount(data: any): number {
  const directCount =
    data?.text_mom_unread_count ??
    data?.support_unread_count ??
    data?.unread_count ??
    data?.thread?.text_mom_unread_count ??
    data?.thread?.support_unread_count ??
    data?.thread?.unread_count;

  if (directCount !== undefined && directCount !== null) {
    return safeCount(directCount);
  }

  const threads = Array.isArray(data?.threads)
    ? data.threads
    : Array.isArray(data)
      ? data
      : [];

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

    return safeCount(total);
  }

  const supportUnread =
    data?.support_unread ??
    data?.thread?.support_unread ??
    data?.support_text_thread?.support_unread;

  return supportUnread === true ? 1 : 0;
}

function emit(count: number) {
  listeners.forEach((listener) => {
    try {
      listener(count);
    } catch (error) {
      console.log("[TextMomBadge] listener error:", error);
    }
  });
}

export async function getTextMomUnreadCount(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(TEXT_MOM_UNREAD_COUNT_KEY);
    return safeCount(raw || 0);
  } catch (error) {
    console.log("[TextMomBadge] failed to read stored count:", error);
    return 0;
  }
}

export async function setTextMomUnreadCount(count: number): Promise<number> {
  const nextCount = safeCount(count);

  try {
    await SecureStore.setItemAsync(
      TEXT_MOM_UNREAD_COUNT_KEY,
      String(nextCount)
    );
  } catch (error) {
    console.log("[TextMomBadge] failed to store count:", error);
  }

  await setPhoneAppIconBadge(nextCount);

  emit(nextCount);
  return nextCount;
}

export async function incrementTextMomUnreadCount(amount = 1): Promise<number> {
  const current = await getTextMomUnreadCount();
  const next = current + amount;

  return setTextMomUnreadCount(next);
}

export async function clearTextMomUnreadCount(): Promise<number> {
  return setTextMomUnreadCount(0);
}

export async function refreshTextMomUnreadCountFromServer(): Promise<number> {
  try {
    const token = await SecureStore.getItemAsync("auth_token");

    if (!token) {
      return setTextMomUnreadCount(0);
    }

    const authUser = await getStoredAuthUser();
    const isSupportUser = isSupportUserFromStoredAuth(authUser);

    const endpoint = isSupportUser
      ? "/v1/support/text_threads"
      : "/v1/support_text_thread";

    const res = await getJson(endpoint, token);

    if (!res.ok) {
      console.log("[TextMomBadge] refresh failed", {
        status: res.status,
      });

      return getTextMomUnreadCount();
    }

    const count = isSupportUser
      ? normalizeAdminUnreadCount(res.json)
      : normalizeUserUnreadCount(res.json);

    return setTextMomUnreadCount(count);
  } catch (error) {
    console.log("[TextMomBadge] refresh error:", error);
    return getTextMomUnreadCount();
  }
}

export function subscribeToTextMomUnreadCount(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}