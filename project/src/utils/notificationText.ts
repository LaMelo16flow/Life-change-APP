import { Notification } from '../lib/supabase';

type ResolvableNotification = Pick<Notification, 'title' | 'message' | 'title_key' | 'message_key' | 'message_params'>;

export function resolveNotificationText(
  notification: ResolvableNotification,
  t: (key: string, params?: Record<string, string | number>) => string
): { title: string; message: string } {
  const params = notification.message_params || undefined;
  return {
    title: notification.title_key ? t(notification.title_key) : notification.title,
    message: notification.message_key ? t(notification.message_key, params) : notification.message,
  };
}
