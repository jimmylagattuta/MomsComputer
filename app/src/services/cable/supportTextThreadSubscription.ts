import type { Cable } from "@rails/actioncable";

type MessageCreatedPayload = {
  type: "support_text.message_created";
  thread_id: number;
  message: any;
  thread: any;
};

type Params = {
  consumer: Cable;
  threadId: number;
  onMessageCreated: (payload: MessageCreatedPayload) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: any) => void;
};

type CableSubscription = {
  unsubscribe: () => void;
};

export function subscribeToSupportTextThread({
  consumer,
  threadId,
  onMessageCreated,
  onConnected,
  onDisconnected,
  onError,
}: Params): CableSubscription {
  return consumer.subscriptions.create(
    {
      channel: "SupportTextThreadChannel",
      thread_id: threadId,
    },
    {
      connected() {
        console.log("[Cable] Connected to thread", threadId);
        onConnected?.();
      },

      disconnected() {
        console.log("[Cable] Disconnected from thread", threadId);
        onDisconnected?.();
      },

      rejected() {
        console.warn("[Cable] Subscription rejected for thread", threadId);
        onError?.("Subscription rejected");
      },

      received(data: any) {
        if (data?.type === "support_text.message_created") {
          onMessageCreated(data);
        }
      },
    }
  ) as CableSubscription;
}