// app/src/subscriptions/linkRevenueCatCustomer.ts

import * as SecureStore from "expo-secure-store";
import { postJson } from "../services/api/client";
import { attachGuestRevenueCatCustomerAfterAuth } from "./attachGuestRevenueCatCustomer";
import {
  clearPendingAnonymousAppUserId,
  getCustomerInfo,
  getPendingAnonymousAppUserId,
  isProActive,
  rcIdentifyUser,
} from "./rcClient";

function isAnonymousRevenueCatId(value: unknown) {
  return String(value || "").startsWith("$RCAnonymousID:");
}

function activeEntitlementKeysFromCustomerInfo(info: any) {
  return Object.keys(info?.entitlements?.active ?? {});
}

/**
 * After backend login/signup succeeds and auth_token is saved:
 *
 * 1. First try to attach by guest_install_id.
 * 2. Then fall back to the old direct anonymous RevenueCat app_user_id link.
 * 3. Then log RevenueCat into the real backend user id.
 *
 * Important order:
 *
 * save auth_token/auth_user
 * → POST /v1/revenuecat/attach_guest_customer
 * → fallback POST /v1/revenuecat/link_customer with Bearer token
 * → RevenueCat logIn(real user id)
 * → app signIn()
 * → route to app
 */
export async function linkRevenueCatCustomerAfterAuth(
  userId: string | number | null | undefined,
) {
  if (userId == null) {
    console.log("[RC_LINK] skipped_missing_user_id");
    return {
      ok: false,
      skipped: true,
      reason: "missing_user_id",
    };
  }

  const realUserId = String(userId);

  let guestAttachResult: any = null;

  try {
    guestAttachResult = await attachGuestRevenueCatCustomerAfterAuth();

    console.log("[RC_LINK] guest_attach_before_direct_link_result", {
      guestAttachResult,
    });
  } catch (e) {
    guestAttachResult = {
      ok: false,
      error: e,
      reason: "guest_attach_failed",
    };

    console.log("[RC_LINK] guest_attach_before_direct_link_failed", e);
  }

  let pendingAnonymousAppUserId: string | null = null;
  let customerInfo: any = null;
  let customerInfoOriginalAppUserId: string | null = null;
  let activeKeys: string[] = [];
  let entitlementPro = false;
  let premiumDetected = false;

  try {
    pendingAnonymousAppUserId = await getPendingAnonymousAppUserId();
  } catch (e) {
    console.log("[RC_LINK] pending_anonymous_lookup_failed", e);
  }

  try {
    customerInfo = await getCustomerInfo();
    customerInfoOriginalAppUserId =
      customerInfo?.originalAppUserId == null
        ? null
        : String(customerInfo.originalAppUserId);

    activeKeys = activeEntitlementKeysFromCustomerInfo(customerInfo);
    entitlementPro = isProActive(customerInfo);
    premiumDetected = entitlementPro || activeKeys.length > 0;

    console.log("[RC_LINK] customer_info_before_backend_link", {
      realUserId,
      pendingAnonymousAppUserId,
      originalAppUserId: customerInfoOriginalAppUserId,
      activeKeys,
      entitlementPro,
      premiumDetected,
      guestAttachResult,
    });
  } catch (e) {
    console.log("[RC_LINK] customer_info_before_backend_link_failed", e);
  }

  /**
   * Preferred fallback: the exact anonymous ID we saved when RevenueCat was
   * configured anonymously.
   *
   * Secondary fallback: CustomerInfo.originalAppUserId, but ONLY if it is still
   * clearly an anonymous RevenueCat ID. This prevents accidentally linking some
   * old real user id like "1" to the newly-created account.
   */
  const anonymousAppUserId =
    pendingAnonymousAppUserId ||
    (isAnonymousRevenueCatId(customerInfoOriginalAppUserId)
      ? customerInfoOriginalAppUserId
      : null);

  let backendLinkResult: any = null;

  if (anonymousAppUserId && anonymousAppUserId !== realUserId) {
    try {
      const authToken = await SecureStore.getItemAsync("auth_token");

      if (!authToken) {
        console.log("[RC_LINK] skipped_missing_auth_token", {
          realUserId,
          anonymousAppUserId,
        });

        backendLinkResult = {
          ok: false,
          skipped: true,
          reason: "missing_auth_token",
          guestAttachResult,
        };
      } else {
        console.log("[RC_LINK] linking_pending_anonymous_customer", {
          anonymousAppUserId,
          realUserId,
          source:
            anonymousAppUserId === pendingAnonymousAppUserId
              ? "secure_store_pending_id"
              : "customer_info_original_app_user_id",
          activeKeys,
          premiumDetected,
          guestAttachResult,
        });

        const { ok, status, json } = await postJson(
          "/v1/revenuecat/link_customer",
          {
            app_user_id: anonymousAppUserId,
          },
          authToken,
        );

        const linked = !!json?.linked;
        const replayed = !!json?.replayed_revenuecat_event;
        const subscriptionActive = !!json?.subscription_active;
        const withoutExistingWebhook =
          !!json?.link_created_without_existing_webhook;
        const liveVerified = !!json?.live_verified;

        backendLinkResult = {
          ok,
          status,
          json,
          linked,
          replayed,
          subscriptionActive,
          withoutExistingWebhook,
          liveVerified,
          guestAttachResult,
        };

        console.log("[RC_LINK] result", {
          ok,
          status,
          linked,
          replayed,
          subscriptionActive,
          withoutExistingWebhook,
          liveVerified,
          guestAttachResult,
        });

        /**
         * Clear the pending anonymous ID only when either:
         *
         * 1. guest attach succeeded with active/replayed/live verified state, OR
         * 2. direct anonymous link succeeded with active/replayed/live verified state.
         *
         * If Rails says:
         * linked=true, replayed=false, subscription_active=false,
         * keep the anonymous ID available for a later retry/fallback.
         */
        const guestJson = guestAttachResult?.json || guestAttachResult?.data || {};
        const guestLinked = guestAttachResult?.ok !== false && guestJson?.linked === true;
        const guestSubscriptionActive =
          guestJson?.subscription_active === true ||
          guestJson?.subscriptionActive === true;
        const guestReplayed =
          guestJson?.replayed_revenuecat_event === true ||
          guestJson?.replay_result?.replayed === true;
        const guestLiveVerified = guestJson?.live_verified === true;

        const shouldClearPendingAnonymousId =
          (guestLinked &&
            (guestSubscriptionActive || guestReplayed || guestLiveVerified)) ||
          (ok && linked && (subscriptionActive || replayed || liveVerified));

        if (shouldClearPendingAnonymousId) {
          await clearPendingAnonymousAppUserId();

          console.log("[RC_LINK] cleared_pending_anonymous_customer", {
            anonymousAppUserId,
            source: guestLinked
              ? "guest_attach_or_direct_link_success"
              : "direct_link_success",
          });
        }
      }
    } catch (e) {
      backendLinkResult = {
        ok: false,
        error: e,
        guestAttachResult,
      };

      console.log("[RC_LINK] failed", e);
    }
  } else {
    backendLinkResult = {
      ok: false,
      skipped: true,
      reason: anonymousAppUserId
        ? "anonymous_id_matches_real_user_id"
        : "missing_anonymous_app_user_id",
      realUserId,
      pendingAnonymousAppUserId,
      originalAppUserId: customerInfoOriginalAppUserId,
      activeKeys,
      premiumDetected,
      guestAttachResult,
    };

    console.log("[RC_LINK] skipped_backend_link", backendLinkResult);
  }

  try {
    console.log("[RC_LINK] identifying_revenuecat_user_after_backend_auth", {
      realUserId,
    });

    await rcIdentifyUser(realUserId);

    console.log("[RC_LINK] identify_after_backend_auth_done", {
      realUserId,
    });
  } catch (e) {
    console.log("[RC_LINK] identify_after_backend_auth_failed", e);
  }

  return {
    ...backendLinkResult,
    guestAttachResult,
  };
}