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
        console.log(
          "Skipping RC link_customer because auth_token was not found."
        );
      } else {
        console.log("Linking pending RC anonymous customer:", anonymousAppUserId);

        const { ok, status, json } = await postJson(
          "/v1/revenuecat/link_customer",
          {
            app_user_id: anonymousAppUserId,
          },
          authToken
        );

        console.log("RC link_customer result:", { ok, status, json });

        if (ok) {
          await clearPendingAnonymousAppUserId();
        }
      }
    } catch (e) {
      console.log("RC link_customer failed:", e);
    }
  }

  try {
    await rcIdentifyUser(realUserId);
  } catch (e) {
    console.log("RC identify after backend auth failed:", e);
  }
}