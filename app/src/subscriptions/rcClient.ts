// app/src/subscriptions/rcClient.ts

import * as SecureStore from "expo-secure-store";
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import { getRevenueCatApiKey } from "./rcKeys";

let configured = false;
let configuredAppUserId: string | null = null;
let rcLogHandlerInstalled = false;

export const RC_PENDING_ANONYMOUS_APP_USER_ID_KEY =
  "momscomputer:rc_pending_anonymous_app_user_id";

/* ======================================================
   REVENUECAT LOGGING
   ====================================================== */

/**
 * RevenueCat can sometimes surface noisy Google Play Billing sandbox/store
 * messages through console.error. In Expo dev, that becomes the ugly bottom
 * LogBox/debugger error.
 *
 * We only suppress the known "OK BillingResult with null purchases" noise.
 * Real RevenueCat errors still get logged.
 */
function installRevenueCatLogHandler() {
  if (rcLogHandlerInstalled) return;
  rcLogHandlerInstalled = true;

  try {
    const anyPurchases = Purchases as any;

    if (typeof anyPurchases.setLogHandler !== "function") {
      return;
    }

    anyPurchases.setLogHandler((logLevel: any, message: string) => {
      const msg = String(message || "");

      const isKnownGoogleBillingNoise =
        msg.includes(
          "onPurchasesUpdated received an OK BillingResult with a Null purchases list"
        ) ||
        msg.includes("BillingWrapper purchases failed to update") ||
        msg.includes("No purchases received") ||
        msg.includes("No purchases received");

      if (isKnownGoogleBillingNoise) {
        console.log("[RevenueCat ignored Google Billing store noise]", msg);
        return;
      }

      const normalizedLevel = String(logLevel || "").toLowerCase();

      /**
       * Important:
       * Do not use console.error here. Expo dev LogBox turns console.error
       * into the nasty on-screen debugger-style error.
       */
      if (normalizedLevel.includes("error")) {
        console.warn("[RevenueCat]", msg);
        return;
      }

      if (normalizedLevel.includes("warn")) {
        console.warn("[RevenueCat]", msg);
        return;
      }

      console.log("[RevenueCat]", msg);
    });
  } catch (e) {
    console.log("RevenueCat log handler setup skipped:", e);
  }
}

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

function isRcAnonymousId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("$RCAnonymousID:");
}

async function rememberAnonymousAppUserId(id: string | null | undefined) {
  if (!isRcAnonymousId(id)) return;

  try {
    await SecureStore.setItemAsync(RC_PENDING_ANONYMOUS_APP_USER_ID_KEY, String(id));
    console.log("RC remembered anonymous appUserID:", id);
  } catch (e) {
    console.log("RC rememberAnonymousAppUserId failed:", e);
  }
}

export async function getPendingAnonymousAppUserId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(RC_PENDING_ANONYMOUS_APP_USER_ID_KEY);
    return isRcAnonymousId(id) ? id : null;
  } catch {
    return null;
  }
}

export async function clearPendingAnonymousAppUserId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RC_PENDING_ANONYMOUS_APP_USER_ID_KEY);
  } catch {}
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

  installRevenueCatLogHandler();

  if (configured) {
    try {
      const current = await getCurrentAppUserId();
      await rememberAnonymousAppUserId(current);
    } catch {}

    return true;
  }

  try {
    /**
     * VERBOSE is helpful during local Android sandbox testing,
     * but keep production less noisy.
     */
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.WARN);

    const storedUserId = await getStoredAuthUserId();

    if (storedUserId) {
      Purchases.configure({
        apiKey,
        appUserID: storedUserId,
      });

      configured = true;
      configuredAppUserId = storedUserId;

      console.log("RC configured with real appUserID:", storedUserId);
      return true;
    }

    // IMPORTANT:
    // Logged-out users must be allowed to subscribe for Apple review.
    // No appUserID here means RevenueCat creates a $RCAnonymousID customer.
    Purchases.configure({
      apiKey,
    });

    configured = true;

    const current = await getCurrentAppUserId();
    configuredAppUserId = current;
    await rememberAnonymousAppUserId(current);

    console.log("RC configured anonymously:", current);
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

    console.log("RC identify attempt:", { current, next });

    if (isRcAnonymousId(current)) {
      await rememberAnonymousAppUserId(current);
    }

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
      console.log("RC logout skipped: already anonymous", current);
      return;
    }

    const info = await Purchases.logOut();
    const current = await getCurrentAppUserId();

    configuredAppUserId = current;
    await rememberAnonymousAppUserId(current);

    console.log(
      "RC logged out to anonymous ->",
      current,
      Object.keys(info?.entitlements?.active ?? {})
    );
  } catch (e) {
    console.log("RC logout failed:", e);
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

  await rememberAnonymousAppUserId(info?.originalAppUserId);

  return info;
}