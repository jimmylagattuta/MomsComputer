import type { Cable } from "@rails/actioncable";

type ThreadUpdatedPayload = {
  type: "support_text.thread_updated";
  thread: any;
};

type Params = {
  consumer: Cable;
  onThreadUpdated: (payload: ThreadUpdatedPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: any) => void;
};

type CableSubscription = {
  unsubscribe: () => void;
};

export function subscribeToSupportInbox({
  consumer,
  onThreadUpdated,
  onConnected,
  onDisconnected,
  onError,
}: Params): CableSubscription {
  return consumer.subscriptions.create(
    { channel: "SupportTextInboxChannel" },
    {
      connected() {
        console.log("[Cable] Connected to support admin inbox");
        onConnected?.();
      },

      disconnected() {
        console.log("[Cable] Disconnected from support admin inbox");
        onDisconnected?.();
      },

      rejected() {
        console.warn("[Cable] Subscription rejected for support admin inbox");
        onError?.("Subscription rejected");
      },

      received(data: any) {
        try {
          if (data?.type === "support_text.thread_updated") {
            onThreadUpdated(data);
          } else {
            console.log("[Cable] Unhandled inbox event:", data?.type);
          }
        } catch (error) {
          console.error("[Cable] Error handling inbox event:", error);
          onError?.(error);
        }
      },
    }
  ) as CableSubscription;
}