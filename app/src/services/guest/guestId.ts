import * as SecureStore from "expo-secure-store";

const GUEST_ID_KEY = "momscomputer.guest_id";

function createGuestId() {
  const randomPart =
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);

  return `guest_${Date.now()}_${randomPart}`.slice(0, 64);
}

export async function getOrCreateGuestId() {
  try {
    const existingGuestId = await SecureStore.getItemAsync(GUEST_ID_KEY);

    if (existingGuestId && existingGuestId.trim().length > 0) {
      return existingGuestId;
    }

    const newGuestId = createGuestId();

    await SecureStore.setItemAsync(GUEST_ID_KEY, newGuestId);

    return newGuestId;
  } catch (error) {
    console.log("PUBLIC ASK MOM GUEST ID FAILED", error);

    // Fallback keeps public Ask Mom usable even if SecureStore fails.
    return createGuestId();
  }
}

export async function clearGuestId() {
  try {
    await SecureStore.deleteItemAsync(GUEST_ID_KEY);
  } catch (error) {
    console.log("PUBLIC ASK MOM CLEAR GUEST ID FAILED", error);
  }
}