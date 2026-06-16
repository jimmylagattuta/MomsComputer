// app/src/services/publicAskMomStorage/publicAskMomGuestIdentity.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY =
  "momscomputer.public_ask_mom_guest_id.v1";

// Legacy AsyncStorage key support.
// AsyncStorage can use ":" keys, so this stays as-is to migrate old users.
const LEGACY_PUBLIC_ASK_MOM_GUEST_ID_KEY = "momscomputer:guest_id";

function isValidGuestId(value: string | null | undefined): value is string {
  if (!value) return false;

  return /^guest_[0-9a-fA-F-]{36}$/.test(value);
}

function createGuestId() {
  return `guest_${Crypto.randomUUID()}`;
}

export async function getOrCreatePublicAskMomGuestId(): Promise<string> {
  const secureGuestId = await SecureStore.getItemAsync(
    SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY
  );

  if (isValidGuestId(secureGuestId)) {
    return secureGuestId;
  }

  const legacyGuestId = await AsyncStorage.getItem(
    LEGACY_PUBLIC_ASK_MOM_GUEST_ID_KEY
  );

  if (isValidGuestId(legacyGuestId)) {
    await SecureStore.setItemAsync(
      SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY,
      legacyGuestId
    );

    return legacyGuestId;
  }

  const newGuestId = createGuestId();

  await SecureStore.setItemAsync(
    SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY,
    newGuestId
  );

  // Keep this only for backward compatibility with older code paths.
  await AsyncStorage.setItem(LEGACY_PUBLIC_ASK_MOM_GUEST_ID_KEY, newGuestId);

  return newGuestId;
}

// Do not use this from production UI.
// This is only useful for local testing/debugging.
export async function clearPublicAskMomGuestIdForDevOnly() {
  await SecureStore.deleteItemAsync(SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY);
  await AsyncStorage.removeItem(LEGACY_PUBLIC_ASK_MOM_GUEST_ID_KEY);
}

export {
    LEGACY_PUBLIC_ASK_MOM_GUEST_ID_KEY, SECURE_PUBLIC_ASK_MOM_GUEST_ID_KEY
};
