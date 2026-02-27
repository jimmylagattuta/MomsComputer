// app/src/subscriptions/useSubscription.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { getCustomerInfo, isProActive } from "./rcClient";

export function useSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // getCustomerInfo() already calls configureRevenueCat() internally
      const info = await getCustomerInfo();
      setCustomerInfo(info);
    } catch {
      setCustomerInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const info = await getCustomerInfo();
        if (mounted) setCustomerInfo(info);
      } catch {
        if (mounted) setCustomerInfo(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // Some SDK versions return void, others return a subscription-like object.
    const sub: any = Purchases.addCustomerInfoUpdateListener((info) => {
      if (!mounted) return;
      setCustomerInfo(info);
    });

    return () => {
      mounted = false;
      sub?.remove?.(); // ✅ prevents "remove of undefined"
    };
  }, []);

  const isPro = useMemo(() => isProActive(customerInfo), [customerInfo]);

  return { customerInfo, isPro, loading, refresh };
}