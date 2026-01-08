// app/src/auth/AuthProvider.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  isAuthed: boolean;
  isBooting: boolean;

  // ✅ Real auth flag setter (called after backend login succeeds)
  signIn: () => Promise<void>;

  // ✅ Keep your old mock if you still want it around
  signInMock: (email: string, password: string) => Promise<void>;

  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "momscomputer:isAuthed";

console.log("ENV CHECK (AuthProvider)", process.env.EXPO_PUBLIC_API_BASE_URL);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Prefer the boolean gate...
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (raw === "1") {
          setIsAuthed(true);
          return;
        }

        // ...but if you already have a token, treat as authed too (prevents bounce)
        const token = await SecureStore.getItemAsync("auth_token");
        if (token) {
          await AsyncStorage.setItem(STORAGE_KEY, "1");
          setIsAuthed(true);
          return;
        }

        setIsAuthed(false);
      } finally {
        setIsBooting(false);
      }
    })();
  }, []);

  // ✅ Call this after your backend login succeeds
  const signIn = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
    setIsAuthed(true);
  };

  // ✅ Keep for Milestone 1 / testing
  const signInMock = async (_email: string, _password: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
    setIsAuthed(true);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await SecureStore.deleteItemAsync("auth_token");
    await SecureStore.deleteItemAsync("auth_user");
    setIsAuthed(false);
  };

  const value = useMemo(
    () => ({ isAuthed, isBooting, signIn, signInMock, signOut }),
    [isAuthed, isBooting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}