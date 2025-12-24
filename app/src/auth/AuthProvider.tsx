// app/src/auth/AuthProvider.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  isAuthed: boolean;
  isBooting: boolean;
  signInMock: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "momscomputer:isAuthed";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setIsAuthed(raw === "1");
      } finally {
        setIsBooting(false);
      }
    })();
  }, []);

  const signInMock = async (email: string, password: string) => {
    if (!email.trim() || !password) {
      throw new Error("Please enter an email and password.");
    }
    await AsyncStorage.setItem(STORAGE_KEY, "1");
    setIsAuthed(true);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setIsAuthed(false);
  };

  const value = useMemo(
    () => ({ isAuthed, isBooting, signInMock, signOut }),
    [isAuthed, isBooting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}