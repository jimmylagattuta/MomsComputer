// app/src/subscriptions/attachGuestRevenueCatCustomer.ts

import * as SecureStore from "expo-secure-store";
import { postJson } from "../services/api/client";
import { getGuestInstallId } from "./guestInstall";
import { getPendingAnonymousAppUserId } from "./rcClient";

export async function attachGuestRevenueCatCustomerAfterAuth() {
  const authToken = await SecureStore.getItemAsync("auth_token");

  if (!authToken) {
    console.log("[RC_GUEST] attach_skipped_missing_auth_token");

    return {
      ok: false,
      skipped: true,
      reason: "missing_auth_token",
    };
  }

  const guestId = await getGuestInstallId();
  const pendingAnonymousAppUserId = await getPendingAnonymousAppUserId();

  if (!guestId && !pendingAnonymousAppUserId) {
    console.log("[RC_GUEST] attach_skipped_missing_guest_and_anonymous_id");

    return {
      ok: false,
      skipped: true,
      reason: "missing_guest_id_and_anonymous_app_user_id",
    };
  }

  console.log("[RC_GUEST] attach_attempt", {
    guestId,
    pendingAnonymousAppUserId,
  });

  const res = await postJson(
    "/v1/revenuecat/attach_guest_customer",
    {
      guest_id: guestId,
      app_user_id: pendingAnonymousAppUserId,
    },
    authToken,
  );

  console.log("[RC_GUEST] attach_result", {
    ok: res.ok,
    status: res.status,
    json: res.json,
  });

  return res;
}