import * as Notifications from "expo-notifications";
import { Redirect, Stack, router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { useAuth } from "../src/auth/AuthProvider";
import { registerForPushNotificationsAsync } from "../src/services/notifications";

function getNotificationData(response: Notifications.NotificationResponse | null) {
  if (!response) return null;
  return response.notification.request.content.data as Record<string, any> | null;
}

export default function AppLayout() {
  const { isAuthed, isBooting } = useAuth();
  const lastHandledKeyRef = useRef<string | null>(null);

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
    const handleNotificationResponse = (
      response: Notifications.NotificationResponse | null
    ) => {
      const data = getNotificationData(response);
      if (!data) return;

      console.log("[Notifications] tapped notification data:", data);

      if (data.type === "support_text" && data.thread_id) {
        const threadId = String(data.thread_id);
        const messageId =
          data.message_id !== undefined && data.message_id !== null
            ? String(data.message_id)
            : "none";

        const dedupeKey = `${data.type}:${threadId}:${messageId}`;
        if (lastHandledKeyRef.current === dedupeKey) return;
        lastHandledKeyRef.current = dedupeKey;

        router.push({
          pathname: "/(app)/text-mom",
          params: { threadId },
        });
      }
    };

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        handleNotificationResponse(response);
      })
      .catch((error) => {
        console.log("[Notifications] failed to get initial notification response", error);
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