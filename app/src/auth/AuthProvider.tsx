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

// 🔧 LOCAL DEV TOGGLE
// Flip this to true when your phone should hit your computer on the same Wi-Fi.
const USE_LOCAL_API = true; // ⬅️ set to false to use EXPO_PUBLIC_API_BASE_URL

// Your computer's LAN IP (from ipconfig) + your Rails port
const LOCAL_API_BASE_URL = "http://192.168.12.141:3000";

// Centralized resolver: use this everywhere (never reference env directly elsewhere)
export const API_BASE_URL = USE_LOCAL_API
  ? LOCAL_API_BASE_URL
  : (process.env.EXPO_PUBLIC_API_BASE_URL as string);

// Safety: prevent accidentally shipping a production build pointing at your LAN
if (__DEV__ === false && USE_LOCAL_API) {
  throw new Error("USE_LOCAL_API is enabled in a non-dev build");
}

console.log("API BASE URL (AuthProvider)", API_BASE_URL);

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
          console.log("JWT TOKEN:", token);
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
    // Add any “per-user app cache” keys here as you create them.
    // (Safe to include keys even if they don’t exist yet.)
    const APP_CACHE_KEYS = [
      STORAGE_KEY,
      "momscomputer:conversation_id",
      "momscomputer:last_channel",
      "momscomputer:ask_mom:draft",
    ];

    try {
      // 1) AsyncStorage: remove session + app caches
      await AsyncStorage.multiRemove(APP_CACHE_KEYS);

      // 2) SecureStore: remove auth secrets
      // (Wrap individually so one failure doesn't block logout)
      try {
        await SecureStore.deleteItemAsync("auth_token");
      } catch {}
      try {
        await SecureStore.deleteItemAsync("auth_user");
      } catch {}
    } finally {
      // 3) Always flip state even if storage operations throw
      setIsAuthed(false);
    }
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
