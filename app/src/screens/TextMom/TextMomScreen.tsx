// app/src/TextMom/TextMomScreen.tsx
import React from "react";
import { useAuth } from "../../auth/AuthProvider";
import TextMomAdminScreen from "./TextMomAdminScreen";
import TextMomUserScreen from "./TextMomUserScreen";

export default function TextMomScreen() {
  const auth = useAuth() as any;
  const user = auth?.user;
  const isAdmin = user?.role === "admin";
  console.log('user', user);
  console.log('isAdmin', isAdmin);

  if (isAdmin) {
    return <TextMomAdminScreen />;
  }

  return <TextMomUserScreen />;
}