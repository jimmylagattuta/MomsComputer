import { Redirect, Stack } from "expo-router";
import React, { useEffect } from "react";
import { useAuth } from "../src/auth/AuthProvider";
import { registerForPushNotificationsAsync } from "../src/services/notifications";

export default function AppLayout() {
  const { isAuthed, isBooting } = useAuth();

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