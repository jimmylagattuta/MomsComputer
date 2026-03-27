// src/services/notifications/notificationTypes.ts
export type AppNotificationType =
  | "test_push"
  | "support_text";

export type SupportTextNotificationData = {
  type: "support_text";
  thread_id: number;
};

export type TestPushNotificationData = {
  type: "test_push";
};

export type AppNotificationData =
  | SupportTextNotificationData
  | TestPushNotificationData
  | Record<string, any>;