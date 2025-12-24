// app/(auth)/_layout.tsx
import { Redirect, Stack } from "expo-router";
import React from "react";
import { useAuth } from "../src/auth/AuthProvider";

export default function AuthLayout() {
  const { isAuthed, isBooting } = useAuth();

  if (isBooting) return null;

  if (isAuthed) {
    return <Redirect href="/(app)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}