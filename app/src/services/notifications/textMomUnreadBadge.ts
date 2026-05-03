import * as SecureStore from "expo-secure-store";

const TEXT_MOM_UNREAD_COUNT_KEY = "text_mom_unread_count";

type Listener = (count: number) => void;

const listeners = new Set<Listener>();

function emit(count: number) {
  listeners.forEach((listener) => {
    try {
      listener(count);
    } catch {}
  });
}

export async function getTextMomUnreadCount(): Promise<number> {
  try {
    const raw = await SecureStore.getItemAsync(TEXT_MOM_UNREAD_COUNT_KEY);
    const parsed = Number(raw || 0);

    if (!Number.isFinite(parsed) || parsed < 0) return 0;

    return Math.floor(parsed);
  } catch {
    return 0;
  }
}

export async function setTextMomUnreadCount(count: number): Promise<number> {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0));

  try {
    await SecureStore.setItemAsync(
      TEXT_MOM_UNREAD_COUNT_KEY,
      String(safeCount)
    );
  } catch {}

  emit(safeCount);
  return safeCount;
}

export async function incrementTextMomUnreadCount(amount = 1): Promise<number> {
  const current = await getTextMomUnreadCount();
  return setTextMomUnreadCount(current + amount);
}

export async function clearTextMomUnreadCount(): Promise<number> {
  return setTextMomUnreadCount(0);
}

export function subscribeToTextMomUnreadCount(listener: Listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}