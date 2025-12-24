// app/index.tsx
import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "./src/auth/AuthProvider";

export default function Index() {
  const { isAuthed, isBooting } = useAuth();

  if (isBooting) return null;

  return <Redirect href={isAuthed ? "/(app)" : "/(auth)/sign-in"} />;
}