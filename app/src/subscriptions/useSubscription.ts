// app/src/subscriptions/useSubscription.ts
import { useCallback, useEffect, useMemo, useState } from "react";
import Purchases, { CustomerInfo } from "react-native-purchases";
import { configureRevenueCat, getCustomerInfo, isProActive } from "./rcClient";

export function useSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const configured = await configureRevenueCat();
      if (!configured) {
        setCustomerInfo(null);
        return;
      }
      const info = await getCustomerInfo();
      setCustomerInfo(info);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const configured = await configureRevenueCat();
        if (!configured) {
          if (mounted) setCustomerInfo(null);
          return;
        }
        const info = await getCustomerInfo();
        if (mounted) setCustomerInfo(info);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // Some versions return void, others return a subscription-like object.
    const sub: any = Purchases.addCustomerInfoUpdateListener((info) => {
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