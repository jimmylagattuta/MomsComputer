// app/index.tsx
import { Redirect } from "expo-router";
import React from "react";
import { useAuth } from "./src/auth/AuthProvider";
import PublicAskMomLanding from "./src/screens/PublicAskMomLanding/PublicAskMomLanding";

export default function Index() {
  const { isAuthed, isBooting } = useAuth();

  if (isBooting) return null;

  if (isAuthed) {
    return <Redirect href="/(app)" />;
  }

  return <PublicAskMomLanding />;
}