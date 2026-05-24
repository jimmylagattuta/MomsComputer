import * as Notifications from "expo-notifications";
import { Redirect, Stack, router, usePathname } from "expo-router";
import React, { useEffect, useRef } from "react";
import { useAuth } from "../src/auth/AuthProvider";
import { registerForPushNotificationsAsync } from "../src/services/notifications";
import {
  clearTextMomUnreadCount,
  incrementTextMomUnreadCount,
  setTextMomUnreadCount,
} from "../src/services/notifications/textMomUnreadBadge";

function getNotificationData(
  response: Notifications.NotificationResponse | null
) {
  if (!response) return null;
  return response.notification.request.content.data as Record<string, any> | null;
}

function getReceivedNotificationData(
  notification: Notifications.Notification | null
) {
  if (!notification) return null;
  return notification.request.content.data as Record<string, any> | null;
}

function isSupportTextNotification(data: Record<string, any> | null) {
  if (!data) return false;

  return (
    data.type === "support_text" ||
    data.type === "support_text.message_created" ||
    data.type === "support_text_message" ||
    data.type === "support_text.thread_updated"
  );
}

function buildNotificationDedupeKey(data: Record<string, any>) {
  const type = data.type ? String(data.type) : "unknown";
  const threadId =
    data.thread_id !== undefined && data.thread_id !== null
      ? String(data.thread_id)
      : "none";
  const messageId =
    data.message_id !== undefined && data.message_id !== null
      ? String(data.message_id)
      : "none";

  return `${type}:${threadId}:${messageId}`;
}

function safeBadgeCount(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.floor(parsed);
}

async function applyNotificationBadgeCount(data: Record<string, any> | null) {
  if (!data) return null;

  const badgeCount =
    safeBadgeCount(data.badge_count) ??
    safeBadgeCount(data.badge) ??
    safeBadgeCount(data.text_mom_unread_count) ??
    safeBadgeCount(data.unread_count);

  if (badgeCount === null) {
    return null;
  }

  console.log("[Notifications] applying badge count from payload:", badgeCount);

  await setTextMomUnreadCount(badgeCount);

  return badgeCount;
}

export default function AppLayout() {
  const { isAuthed, isBooting } = useAuth();
  const pathname = usePathname();

  const pathnameRef = useRef(pathname);
  const lastHandledKeyRef = useRef<string | null>(null);
  const lastReceivedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then((token) => {
        if (token) {
          console.log("Ready to send push token to backend:", token);
        }
      })
      .catch((error) => {
        console.log("Push registration failed:", error);
      });
  }, []);

  useEffect(() => {
    const handleNotificationReceived = async (
      notification: Notifications.Notification | null
    ) => {
      const data = getReceivedNotificationData(notification);
      if (!isSupportTextNotification(data)) return;

      console.log("[Notifications] received notification data:", data);

      const dedupeKey = buildNotificationDedupeKey(data || {});
      if (lastReceivedKeyRef.current === dedupeKey) return;
      lastReceivedKeyRef.current = dedupeKey;

      const currentPath = pathnameRef.current || "";
      const alreadyInTextMom = currentPath.includes("/text-mom");

      if (alreadyInTextMom) {
        await clearTextMomUnreadCount();
        return;
      }

      const appliedBadgeCount = await applyNotificationBadgeCount(data);

      if (appliedBadgeCount === null) {
        await incrementTextMomUnreadCount(1);
      }
    };

    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void handleNotificationReceived(notification);
    });

    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const handleNotificationResponse = async (
      response: Notifications.NotificationResponse | null
    ) => {
      const data = getNotificationData(response);
      if (!data) return;

      console.log("[Notifications] tapped notification data:", data);

      if (isSupportTextNotification(data) && data.thread_id) {
        const threadId = String(data.thread_id);
        const dedupeKey = buildNotificationDedupeKey(data);

        if (lastHandledKeyRef.current === dedupeKey) return;
        lastHandledKeyRef.current = dedupeKey;

        await clearTextMomUnreadCount();

        router.push({
          pathname: "/(app)/text-mom",
          params: { threadId },
        });
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        void handleNotificationResponse(response);
      }
    );

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        void handleNotificationResponse(response);
      })
      .catch((error) => {
        console.log(
          "[Notifications] failed to get initial notification response",
          error
        );
      });

    return () => {
      sub.remove();
    };
  }, []);

  if (isBooting) return null;
  if (!isAuthed) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0B1220" },
      }}
    />
  );
}