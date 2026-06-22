// app/src/subscriptions/rememberGuestRevenueCatCustomer.ts

import { postJson } from "../services/api/client";
import { getOrCreateGuestInstallId } from "./guestInstall";
import {
    getCustomerInfo,
    getPendingAnonymousAppUserId,
    rememberPendingAnonymousAppUserId,
} from "./rcClient";

function isAnonymousRevenueCatId(value: unknown) {
  return String(value || "").startsWith("$RCAnonymousID:");
}

export async function rememberGuestRevenueCatCustomer(reason = "unknown") {
  const guestId = await getOrCreateGuestInstallId();

  let pendingAnonymousAppUserId: string | null = null;
  let originalAppUserId: string | null = null;
  let activeKeys: string[] = [];

  try {
    pendingAnonymousAppUserId = await getPendingAnonymousAppUserId();
  } catch {}

  try {
    const info: any = await getCustomerInfo();

    originalAppUserId =
      info?.originalAppUserId == null ? null : String(info.originalAppUserId);

    activeKeys = Object.keys(info?.entitlements?.active ?? {});
  } catch (e) {
    console.log("[RC_GUEST] customer_info_failed", {
      reason,
      error: e,
    });
  }

  const anonymousAppUserId =
    pendingAnonymousAppUserId ||
    (isAnonymousRevenueCatId(originalAppUserId) ? originalAppUserId : null);

  console.log("[RC_GUEST] remember_attempt", {
    reason,
    guestId,
    pendingAnonymousAppUserId,
    originalAppUserId,
    anonymousAppUserId,
    activeKeys,
  });

  if (!anonymousAppUserId) {
    console.log("[RC_GUEST] remember_skipped_missing_anonymous_id", {
      reason,
      guestId,
      pendingAnonymousAppUserId,
      originalAppUserId,
      activeKeys,
    });

    return {
      ok: false,
      skipped: true,
      reason: "missing_anonymous_app_user_id",
      guestId,
      originalAppUserId,
      activeKeys,
    };
  }

  try {
    await rememberPendingAnonymousAppUserId(anonymousAppUserId);
  } catch {}

  const res = await postJson("/v1/revenuecat/remember_guest_customer", {
    guest_id: guestId,
    app_user_id: anonymousAppUserId,
    original_app_user_id: originalAppUserId || anonymousAppUserId,
  });

  console.log("[RC_GUEST] remember_result", {
    reason,
    guestId,
    anonymousAppUserId,
    ok: res.ok,
    status: res.status,
    json: res.json,
  });

  return {
    ...res,
    guestId,
    anonymousAppUserId,
  };
}