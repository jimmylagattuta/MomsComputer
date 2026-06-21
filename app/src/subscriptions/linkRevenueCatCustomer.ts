// app/src/subscriptions/linkRevenueCatCustomer.ts

import * as SecureStore from "expo-secure-store";
import { postJson } from "../services/api/client";
import {
  clearPendingAnonymousAppUserId,
  getPendingAnonymousAppUserId,
  rcIdentifyUser,
} from "./rcClient";

/**
 * After backend login/signup succeeds and auth_token is saved:
 *
 * 1. If the device has a pending $RCAnonymousID, tell Rails to link/replay it.
 * 2. Then log RevenueCat into the real backend user id.
 *
 * Important order:
 *
 * save auth_token/auth_user
 * → POST /v1/revenuecat/link_customer with Bearer token
 * → RevenueCat logIn(real user id)
 * → app signIn()
 * → route to app
 */
export async function linkRevenueCatCustomerAfterAuth(
  userId: string | number | null | undefined
) {
  if (userId == null) return;

  const realUserId = String(userId);
  const anonymousAppUserId = await getPendingAnonymousAppUserId();

  if (anonymousAppUserId && anonymousAppUserId !== realUserId) {
    try {
      const authToken = await SecureStore.getItemAsync("auth_token");

      if (!authToken) {
        console.log("[RC_LINK] skipped_missing_auth_token");
      } else {
        console.log("[RC_LINK] linking_pending_anonymous_customer", {
          anonymousAppUserId,
          realUserId,
        });

        const { ok, status, json } = await postJson(
          "/v1/revenuecat/link_customer",
          {
            app_user_id: anonymousAppUserId,
          },
          authToken
        );

        const linked = !!json?.linked;
        const replayed = !!json?.replayed_revenuecat_event;
        const subscriptionActive = !!json?.subscription_active;
        const withoutExistingWebhook = !!json?.link_created_without_existing_webhook;

        console.log("[RC_LINK] result", {
          ok,
          status,
          linked,
          replayed,
          subscriptionActive,
          withoutExistingWebhook,
        });

        /**
         * Do NOT clear the pending anonymous ID just because Rails accepted the link.
         *
         * If Rails says:
         * linked=true, replayed=false, subscription_active=false,
         * then we still need this anonymous ID available for a later retry/fallback.
         */
        if (ok && linked && (subscriptionActive || replayed)) {
          await clearPendingAnonymousAppUserId();

          console.log("[RC_LINK] cleared_pending_anonymous_customer", {
            anonymousAppUserId,
          });
        }
      }
    } catch (e) {
      console.log("[RC_LINK] failed", e);
    }
  }

  try {
    await rcIdentifyUser(realUserId);
  } catch (e) {
    console.log("[RC_LINK] identify_after_backend_auth_failed", e);
  }
}