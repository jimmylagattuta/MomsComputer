import { createConsumer, type Cable } from "@rails/actioncable";
import * as SecureStore from "expo-secure-store";
import { API_BASE } from "../api/client";

let cableConsumerPromise: Promise<Cable> | null = null;

function ensureActionCableReactNativeCompat() {
  const g: any = globalThis as any;

  if (typeof g.addEventListener !== "function") {
    g.addEventListener = () => {};
  }

  if (typeof g.removeEventListener !== "function") {
    g.removeEventListener = () => {};
  }

  if (!g.document) {
    g.document = {};
  }

  if (typeof g.document.addEventListener !== "function") {
    g.document.addEventListener = () => {};
  }

  if (typeof g.document.removeEventListener !== "function") {
    g.document.removeEventListener = () => {};
  }

  if (typeof g.document.visibilityState === "undefined") {
    g.document.visibilityState = "visible";
  }

  if (!g.window) {
    g.window = g;
  }
}

function toCableUrl(baseUrl: string, token: string) {
  const url = new URL(baseUrl);
  const protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return `${protocol}//${url.host}/cable?token=${encodeURIComponent(token)}`;
}

export async function buildCableConsumer(): Promise<Cable> {
  if (cableConsumerPromise) {
    return cableConsumerPromise;
  }

  cableConsumerPromise = (async () => {
    ensureActionCableReactNativeCompat();

    const token = await SecureStore.getItemAsync("auth_token");

    if (!token) {
      console.warn("[Cable] Missing auth token");
      throw new Error("Missing auth token");
    }

    if (!API_BASE) {
      throw new Error("Missing API_BASE");
    }

    const cableUrl = toCableUrl(API_BASE, token);

    console.log("[Cable] Connecting to:", cableUrl);

    return createConsumer(cableUrl);
  })();

  return cableConsumerPromise;
}

export function resetCableConsumer() {
  cableConsumerPromise = null;
}