import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useMemo, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import {
  configureRevenueCat,
  getCustomerInfo,
  isProActive,
  rcIdentifyUser,
} from "./rcClient";

export function useSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [identityReady, setIdentityReady] = useState(false);

  const syncRevenueCatIdentity = useCallback(async () => {
    try {
      const authUserRaw = await SecureStore.getItemAsync("auth_user");
      const authUser = authUserRaw ? JSON.parse(authUserRaw) : null;
      const userId = authUser?.id != null ? String(authUser.id) : null;

      if (!userId) {
        setIdentityReady(true);
        return false;
      }

      const ok = await configureRevenueCat();
      if (!ok) {
        setIdentityReady(true);
        return false;
      }

      await rcIdentifyUser(userId);
      setIdentityReady(true);
      return true;
    } catch (e) {
      console.log("RC identity sync failed:", e);
      setIdentityReady(true);
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setIdentityReady(false);
      const ready = await syncRevenueCatIdentity();

      if (!ready) {
        setCustomerInfo(null);
        return;
      }

      const info = await getCustomerInfo();
      setCustomerInfo(info);
    } catch (e) {
      console.log("Subscription refresh failed:", e);
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  }, [syncRevenueCatIdentity]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setIdentityReady(false);

      try {
        const ready = await syncRevenueCatIdentity();

        if (!ready) {
          if (mounted) setCustomerInfo(null);
          return;
        }

        const info = await getCustomerInfo();
        if (mounted) setCustomerInfo(info);
      } catch (e) {
        console.log("Initial subscription load failed:", e);
        if (mounted) setCustomerInfo(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const sub: any = Purchases.addCustomerInfoUpdateListener((info) => {
      if (!mounted) return;
      setCustomerInfo(info);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, [syncRevenueCatIdentity]);

  const isPro = useMemo(() => {
    if (!identityReady) return false;
    return isProActive(customerInfo);
  }, [customerInfo, identityReady]);

  return { customerInfo, isPro, loading, refresh, identityReady };
}