// app/src/subscriptions/guestInstall.ts

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const GUEST_INSTALL_ID_KEY = "momscomputer.guest_install_id";

function makeGuestInstallId() {
  return `guest_${Crypto.randomUUID()}`;
}

export async function getOrCreateGuestInstallId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(GUEST_INSTALL_ID_KEY);

    if (existing && existing.startsWith("guest_")) {
      return existing;
    }

    const next = makeGuestInstallId();
    await SecureStore.setItemAsync(GUEST_INSTALL_ID_KEY, next);

    return next;
  } catch {
    const fallback = makeGuestInstallId();

    try {
      await SecureStore.setItemAsync(GUEST_INSTALL_ID_KEY, fallback);
    } catch {}

    return fallback;
  }
}

export async function getGuestInstallId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(GUEST_INSTALL_ID_KEY);
  } catch {
    return null;
  }
}

export async function clearGuestInstallIdForDevOnly(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(GUEST_INSTALL_ID_KEY);
  } catch {}
}