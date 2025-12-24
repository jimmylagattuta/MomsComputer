// app/(app)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React from "react";
import { useAuth } from "../src/auth/AuthProvider";

export default function AppLayout() {
  const { isAuthed, isBooting } = useAuth();

  if (isBooting) return null;
  if (!isAuthed) return <Redirect href="/(auth)/sign-in" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false, // 👈 give HomeScreen the full height
        contentStyle: { backgroundColor: "#0B1220" },
      }}
    />
  );
}
