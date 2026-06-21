// app/src/subscriptions/rcClient.ts

import * as SecureStore from "expo-secure-store";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import { getRevenueCatApiKey } from "./rcKeys";

let configured = false;
let configuredAppUserId: string | null = null;

/**
 * IMPORTANT:
 * Expo SecureStore keys may only contain alphanumeric characters, ".", "-", and "_".
 * Do NOT use ":" here.
 */
export const RC_PENDING_ANONYMOUS_APP_USER_ID_KEY =
  "momscomputer.rc_pending_anonymous_app_user_id";

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
    console.log("[RC_FLOW] getStoredAuthUserId failed:", e);
    return null;
  }
}

function isRcAnonymousId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("$RCAnonymousID:");
}

async function rememberAnonymousAppUserId(id: string | null | undefined) {
  if (!isRcAnonymousId(id)) return;

  try {
    await SecureStore.setItemAsync(
      RC_PENDING_ANONYMOUS_APP_USER_ID_KEY,
      String(id)
    );
  } catch (e) {
    console.log("[RC_FLOW] rememberAnonymousAppUserId failed:", e);
  }
}

export async function getPendingAnonymousAppUserId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(
      RC_PENDING_ANONYMOUS_APP_USER_ID_KEY
    );

    return isRcAnonymousId(id) ? id : null;
  } catch {
    return null;
  }
}

export async function clearPendingAnonymousAppUserId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RC_PENDING_ANONYMOUS_APP_USER_ID_KEY);
  } catch {
    // ignore
  }
}

/* ======================================================
   CONFIGURATION
   ====================================================== */

export async function configureRevenueCat(): Promise<boolean> {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    console.log("[RC_FLOW] configure skipped: missing API key");
    return false;
  }

  if (configured) {
    try {
      const current = await getCurrentAppUserId();
      await rememberAnonymousAppUserId(current);
    } catch {
      // ignore
    }

    return true;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);

    const storedUserId = await getStoredAuthUserId();

    if (storedUserId) {
      Purchases.configure({
        apiKey,
        appUserID: storedUserId,
      });

      configured = true;
      configuredAppUserId = storedUserId;

      console.log("[RC_FLOW] configured_real_user", {
        appUserId: storedUserId,
      });

      return true;
    }

    // Logged-out users must be allowed to subscribe for Apple review.
    Purchases.configure({
      apiKey,
    });

    configured = true;

    const current = await getCurrentAppUserId();
    configuredAppUserId = current;
    await rememberAnonymousAppUserId(current);

    console.log("[RC_FLOW] configured_anonymous", {
      appUserId: current,
    });

    return true;
  } catch (e) {
    console.log("[RC_FLOW] configure failed:", e);
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

  await rememberAnonymousAppUserId(info?.originalAppUserId);

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
 * Move RevenueCat from anonymous/guest identity to the real backend user.
 *
 * IMPORTANT:
 * The backend link_customer call should happen BEFORE this when a pending
 * $RCAnonymousID exists, so Rails can replay anonymous RevenueCat events.
 */
export async function rcIdentifyUser(
  appUserId: string
): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat();
    if (!ok) return null;

    const next = String(appUserId);
    const current = await getCurrentAppUserId();

    if (isRcAnonymousId(current)) {
      await rememberAnonymousAppUserId(current);
    }

    if (current === next) {
      return await Purchases.getCustomerInfo();
    }

    const result: any = await (Purchases as any).logIn(next);
    const info: CustomerInfo | null = result?.customerInfo ?? null;

    configuredAppUserId = next;

    console.log("[RC_FLOW] login_success", {
      appUserId: next,
      originalAppUserId: info?.originalAppUserId,
      activeKeys: Object.keys(info?.entitlements?.active ?? {}),
      entitlementIdMatched: isProActive(info),
    });

    return info;
  } catch (e) {
    console.log("[RC_FLOW] identify failed:", e);
    return null;
  }
}

/**
 * On app sign-out, we DO want RevenueCat to leave the old real user.
 * RevenueCat logOut creates a fresh anonymous customer.
 *
 * This prevents a logged-out purchase from accidentally attaching to
 * the previous signed-in user on the same device.
 */
export async function rcLogoutUser(): Promise<void> {
  try {
    const ok = await configureRevenueCat();
    if (!ok) return;

    const anonymous = await isAnonymousUser();

    if (anonymous === true) {
      const current = await getCurrentAppUserId();
      await rememberAnonymousAppUserId(current);
      return;
    }

    const info = await Purchases.logOut();
    const current = await getCurrentAppUserId();

    configuredAppUserId = current;
    await rememberAnonymousAppUserId(current);

    console.log("[RC_FLOW] logged_out_to_anonymous", {
      appUserId: current,
      originalAppUserId: info?.originalAppUserId,
      activeKeys: Object.keys(info?.entitlements?.active ?? {}),
      entitlementIdMatched: isProActive(info),
    });
  } catch (e) {
    console.log("[RC_FLOW] logout failed:", e);
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

  console.log("[RC_FLOW] restore_purchases", {
    originalAppUserId: info?.originalAppUserId,
    activeKeys: Object.keys(info?.entitlements?.active ?? {}),
    entitlementIdMatched: isProActive(info),
  });

  await rememberAnonymousAppUserId(info?.originalAppUserId);

  return info;
}