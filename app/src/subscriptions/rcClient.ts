// app/src/subscriptions/rcClient.ts
import Purchases, { CustomerInfo, LOG_LEVEL } from "react-native-purchases";
import { ENTITLEMENT_ID } from "./constants";
import { getRevenueCatApiKey } from "./rcKeys";

let configured = false;
let configuring: Promise<boolean> | null = null;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function isValidKey(key: unknown): key is string {
  return typeof key === "string" && key.trim().length > 0;
}

export async function configureRevenueCat(): Promise<boolean> {
  // Fast path
  if (configured) return true;

  // If a configure is already in flight, await it.
  if (configuring) return configuring;

  configuring = (async () => {
    const apiKeyRaw = getRevenueCatApiKey();

    // Never call native if key is missing/invalid.
    if (!isValidKey(apiKeyRaw)) {
      return false;
    }

    // Small defer helps avoid "too-early" TurboModule init crashes on some builds.
    // Keep it tiny; you can bump to 250-500ms temporarily while debugging if needed.
    await sleep(0);

    try {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

      // IMPORTANT: await configure so we don't mark configured=true before it finishes.
      await Purchases.configure({ apiKey: apiKeyRaw });

      configured = true;
      return true;
    } catch (e) {
      // NOTE: JS try/catch won't catch an Obj-C NSException.
      // This catches JS-thrown errors; native exceptions can still hard-crash.
      return false;
    } finally {
      configuring = null;
    }
  })();

  return configuring;
}

export function isProActive(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return !!customerInfo.entitlements.active?.[ENTITLEMENT_ID];
}

function notConfiguredError() {
  return new Error("RevenueCat not configured (missing/invalid API key).");
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  const ok = await configureRevenueCat();
  if (!ok) throw notConfiguredError();
  return Purchases.getCustomerInfo();
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const ok = await configureRevenueCat();
  if (!ok) throw notConfiguredError();
  return Purchases.restorePurchases();
}