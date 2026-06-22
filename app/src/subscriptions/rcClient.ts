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

/**
 * IMPORTANT:
 * This is only used to determine whether the app currently has a saved auth session.
 *
 * We do NOT use this value to configure RevenueCat anymore.
 *
 * Old bug:
 * - auth_user could be stale, like { id: 1 }
 * - configureRevenueCat() passed appUserID: "1"
 * - logged-out app became RevenueCat user "1"
 *
 * New rule:
 * - configureRevenueCat() configures RevenueCat only
 * - rcIdentifyUser(user.id) is the only place that identifies as a real backend user
 */
async function getStoredAuthSessionUserId(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync("auth_token");
    if (!token) return null;

    const raw = await SecureStore.getItemAsync("auth_user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const id = parsed?.id;

    if (id == null) return null;

    return String(id);
  } catch (e) {
    console.log("[RC_FLOW] getStoredAuthSessionUserId failed:", e);
    return null;
  }
}

function isRcAnonymousId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("$RCAnonymousID:");
}

function isRealRevenueCatId(id: string | null | undefined): boolean {
  const value = String(id || "").trim();
  return !!value && !isRcAnonymousId(value);
}

/**
 * Exported helper used by the guest RevenueCat attach flow.
 *
 * This stores the anonymous RevenueCat customer id BEFORE we log in to
 * RevenueCat as the real Rails user id.
 */
export async function rememberPendingAnonymousAppUserId(
  appUserId: string | null | undefined,
): Promise<void> {
  const value = String(appUserId || "").trim();

  if (!isRcAnonymousId(value)) {
    return;
  }

  try {
    await SecureStore.setItemAsync(RC_PENDING_ANONYMOUS_APP_USER_ID_KEY, value);

    console.log("[RC_FLOW] remembered_pending_anonymous_app_user_id", {
      appUserId: value,
    });
  } catch (e) {
    console.log("[RC_FLOW] remember_pending_anonymous_app_user_id_failed", e);
  }
}

async function rememberAnonymousAppUserId(
  id: string | null | undefined,
): Promise<void> {
  await rememberPendingAnonymousAppUserId(id);
}

export async function getPendingAnonymousAppUserId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(
      RC_PENDING_ANONYMOUS_APP_USER_ID_KEY,
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

async function ensureAnonymousIfNoAuthSession(reason: string): Promise<void> {
  try {
    const storedSessionUserId = await getStoredAuthSessionUserId();
    const current = await getCurrentAppUserId();
    const anonymous = await isAnonymousUser();

    console.log("[RC_FLOW] logged_out_identity_guard", {
      reason,
      storedSessionUserId,
      currentAppUserId: current,
      isAnonymous: anonymous,
    });

    /**
     * If the app has a real auth session, do not force logout here.
     * rcIdentifyUser(user.id) will handle the real RevenueCat identity.
     */
    if (storedSessionUserId) {
      return;
    }

    /**
     * If there is no auth session but RevenueCat is currently on a real backend id
     * like "1", "101", "102", force RevenueCat back to anonymous.
     */
    if (isRealRevenueCatId(current)) {
      console.log("[RC_FLOW] forcing_anonymous_revenuecat_customer", {
        reason,
        currentAppUserId: current,
      });

      const info = await Purchases.logOut();
      const freshCurrent = await getCurrentAppUserId();

      configuredAppUserId = freshCurrent;

      await rememberAnonymousAppUserId(freshCurrent);

      console.log("[RC_FLOW] forced_anonymous_revenuecat_customer_done", {
        reason,
        previousAppUserId: current,
        freshAppUserId: freshCurrent,
        originalAppUserId: info?.originalAppUserId,
        activeKeys: Object.keys(info?.entitlements?.active ?? {}),
        entitlementIdMatched: isProActive(info),
      });

      return;
    }

    if (isRcAnonymousId(current)) {
      await rememberAnonymousAppUserId(current);
    }
  } catch (e) {
    console.log("[RC_FLOW] logged_out_identity_guard_failed", {
      reason,
      error: e,
    });
  }
}

export async function configureRevenueCat(): Promise<boolean> {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    console.log("[RC_FLOW] configure skipped: missing API key");
    return false;
  }

  if (configured) {
    try {
      await ensureAnonymousIfNoAuthSession("already_configured");

      const current = await getCurrentAppUserId();
      configuredAppUserId = current;

      if (isRcAnonymousId(current)) {
        await rememberAnonymousAppUserId(current);
      }
    } catch {
      // ignore
    }

    return true;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);

    /**
     * IMPORTANT:
     * Do NOT pass appUserID here.
     *
     * We used to read SecureStore auth_user and pass appUserID: storedUserId.
     * That caused stale user "1" to leak into logged-out anonymous purchase flows.
     *
     * RevenueCat should configure anonymously by default.
     * Only rcIdentifyUser(user.id) may call Purchases.logIn(realUserId).
     */
    Purchases.configure({
      apiKey,
    });

    configured = true;

    await ensureAnonymousIfNoAuthSession("fresh_configure");

    const current = await getCurrentAppUserId();
    configuredAppUserId = current;

    if (isRcAnonymousId(current)) {
      await rememberAnonymousAppUserId(current);
    }

    console.log("[RC_FLOW] configured", {
      appUserId: current,
      isAnonymousId: isRcAnonymousId(current),
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

  const currentAppUserId = await getCurrentAppUserId();
  const originalAppUserId = String(info?.originalAppUserId || "");

  if (isRcAnonymousId(currentAppUserId)) {
    await rememberPendingAnonymousAppUserId(currentAppUserId);
  }

  if (isRcAnonymousId(originalAppUserId)) {
    await rememberPendingAnonymousAppUserId(originalAppUserId);
  }

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
 * The backend guest attach/link_customer call should happen BEFORE this when a
 * pending $RCAnonymousID exists, so Rails can attach/replay/verify anonymous
 * RevenueCat events before RevenueCat changes to the real user id.
 */
export async function rcIdentifyUser(
  appUserId: string,
): Promise<CustomerInfo | null> {
  try {
    const ok = await configureRevenueCat();
    if (!ok) return null;

    const next = String(appUserId || "").trim();
    if (!next) return null;

    const current = await getCurrentAppUserId();

    if (isRcAnonymousId(current)) {
      await rememberPendingAnonymousAppUserId(current);
    }

    if (current === next) {
      const info = await Purchases.getCustomerInfo();

      console.log("[RC_FLOW] identify_skipped_already_current_user", {
        appUserId: next,
        originalAppUserId: info?.originalAppUserId,
        activeKeys: Object.keys(info?.entitlements?.active ?? {}),
        entitlementIdMatched: isProActive(info),
      });

      return info;
    }

    const result: any = await (Purchases as any).logIn(next);
    const info: CustomerInfo | null = result?.customerInfo ?? null;

    configuredAppUserId = next;

    console.log("[RC_FLOW] login_success", {
      appUserId: next,
      previousAppUserId: current,
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

    const currentBefore = await getCurrentAppUserId();
    const anonymous = await isAnonymousUser();

    if (anonymous === true || isRcAnonymousId(currentBefore)) {
      await rememberPendingAnonymousAppUserId(currentBefore);

      console.log("[RC_FLOW] logout_skipped_already_anonymous", {
        appUserId: currentBefore,
      });

      return;
    }

    const info = await Purchases.logOut();
    const currentAfter = await getCurrentAppUserId();

    configuredAppUserId = currentAfter;

    await rememberPendingAnonymousAppUserId(currentAfter);

    console.log("[RC_FLOW] logged_out_to_anonymous", {
      previousAppUserId: currentBefore,
      appUserId: currentAfter,
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

  const currentAppUserId = await getCurrentAppUserId();
  const originalAppUserId = String(info?.originalAppUserId || "");

  console.log("[RC_FLOW] restore_purchases", {
    currentAppUserId,
    originalAppUserId,
    activeKeys: Object.keys(info?.entitlements?.active ?? {}),
    entitlementIdMatched: isProActive(info),
  });

  if (isRcAnonymousId(currentAppUserId)) {
    await rememberPendingAnonymousAppUserId(currentAppUserId);
  }

  if (isRcAnonymousId(originalAppUserId)) {
    await rememberPendingAnonymousAppUserId(originalAppUserId);
  }

  return info;
}