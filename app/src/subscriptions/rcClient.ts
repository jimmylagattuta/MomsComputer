// app/src/subscriptions/rcClient.ts

import * as SecureStore from "expo-secure-store";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import { getRevenueCatApiKey } from "./rcKeys";

let configured = false;
let configuredAppUserId: string | null = null;

/* ======================================================
   AUTH / USER HELPERS
   ====================================================== */

async function getStoredAuthUserId(): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync("auth_user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const id = parsed?.id;

    if (id == null) return null;
    return String(id);
  } catch (e) {
    console.log("RC getStoredAuthUserId failed:", e);
    return null;
  }
}

/* ======================================================
   CONFIGURATION
   ====================================================== */

export async function configureRevenueCat(): Promise<boolean> {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.log("RC configure skipped: missing API key");
    return false;
  }

  const appUserID = await getStoredAuthUserId();
  if (!appUserID) {
    console.log("RC configure skipped: no real app user id available yet");
    return false;
  }

  if (configured && configuredAppUserId === appUserID) {
    return true;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

    // IMPORTANT:
    // Configure with a real app user id so RevenueCat never creates $RCAnonymousID.
    Purchases.configure({
      apiKey,
      appUserID,
    });

    configured = true;
    configuredAppUserId = appUserID;

    console.log("RC configured with appUserID:", appUserID);
    return true;
  } catch (e) {
    console.log("RC configure failed:", e);
    return false;
  }
}

/* ======================================================
   CUSTOMER INFO
   ====================================================== */

export function isProActive(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return !!customerInfo.entitlements.active?.[ENTITLEMENT_ID];
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  const ok = await configureRevenueCat();
  if (!ok) {
    throw new Error("RevenueCat not configured with a real app user id");
  }

  const info = await Purchases.getCustomerInfo();

  console.log(
    "RC getCustomerInfo ->",
    info?.originalAppUserId,
    Object.keys(info?.entitlements?.active ?? {})
  );

  return info;
}

/* ======================================================
   IDENTITY HELPERS
   ====================================================== */

export async function getCurrentAppUserId(): Promise<string | null> {
  try {
    const maybe = (Purchases as any).getAppUserID?.();
    const id = typeof maybe?.then === "function" ? await maybe : maybe;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

export async function isAnonymousUser(): Promise<boolean | null> {
  try {
    const fn = (Purchases as any).isAnonymous;
    if (typeof fn !== "function") return null;

    const maybe = fn();
    const val = typeof maybe?.then === "function" ? await maybe : maybe;
    return typeof val === "boolean" ? val : null;
  } catch {
    return null;
  }
}

/**
 * Keep RevenueCat tied to your real backend/app user.
 * No anonymous fallback.
 */
export async function rcIdentifyUser(
  appUserId: string
): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat();
    if (!ok) return null;

    const next = String(appUserId);
    const current = await getCurrentAppUserId();

    console.log("RC identify attempt:", { current, next });

    if (current === next) {
      console.log("RC already identified as:", next);
      return await Purchases.getCustomerInfo();
    }

    const result: any = await (Purchases as any).logIn(next);
    const info: CustomerInfo | null = result?.customerInfo ?? null;

    configuredAppUserId = next;

    console.log(
      "RC logIn success ->",
      info?.originalAppUserId,
      Object.keys(info?.entitlements?.active ?? {})
    );

    return info;
  } catch (e) {
    console.log("rcIdentifyUser failed:", e);
    return null;
  }
}

/**
 * Since you do NOT want anonymous users,
 * do not call RevenueCat logOut().
 *
 * App sign-out should clear your own auth,
 * then you can stop showing subscription UI until a real user signs back in.
 */
export async function rcLogoutUser(): Promise<void> {
  console.log("RC logout skipped intentionally: anonymous users are disabled");
}

/* ======================================================
   RESTORE
   ====================================================== */

export async function restorePurchases(): Promise<CustomerInfo> {
  const ok = await configureRevenueCat();
  if (!ok) {
    throw new Error("RevenueCat not configured with a real app user id");
  }

  const info = await Purchases.restorePurchases();

  console.log(
    "RC restorePurchases ->",
    info?.originalAppUserId,
    Object.keys(info?.entitlements?.active ?? {})
  );

  return info;
}