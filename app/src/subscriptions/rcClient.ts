// app/src/subscriptions/rcClient.ts

import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import { getRevenueCatApiKey } from "./rcKeys";

let configured = false;

/* ======================================================
   CONFIGURATION
   ====================================================== */

export async function configureRevenueCat(): Promise<boolean> {
  if (configured) return true;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.log("RC configure skipped: missing API key");
    return false;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({ apiKey });
    configured = true;
    console.log("RC configured");
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
    throw new Error("RevenueCat not configured");
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

// Safe helper to read current App User ID (sync or async compatible)
export async function getCurrentAppUserId(): Promise<string | null> {
  try {
    const maybe = (Purchases as any).getAppUserID?.();
    const id = typeof maybe?.then === "function" ? await maybe : maybe;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

// Safe helper to check anonymous state
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
 * Identify logged-in backend user with RevenueCat.
 * This switches off $RCAnonymousID.
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
 * Logout from RevenueCat.
 * This creates a new anonymous ID.
 */
export async function rcLogoutUser(): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat();
    if (!ok) return null;

    const info: any = await (Purchases as any).logOut?.();

    const customerInfo: CustomerInfo | null = info ?? null;

    console.log("RC logOut ->", customerInfo?.originalAppUserId);

    return customerInfo;
  } catch (e) {
    console.log("rcLogoutUser failed:", e);
    return null;
  }
}

/* ======================================================
   RESTORE
   ====================================================== */

export async function restorePurchases(): Promise<CustomerInfo> {
  const ok = await configureRevenueCat();
  if (!ok) {
    throw new Error("RevenueCat not configured");
  }

  const info = await Purchases.restorePurchases();

  console.log(
    "RC restorePurchases ->",
    info?.originalAppUserId,
    Object.keys(info?.entitlements?.active ?? {})
  );

  return info;
}