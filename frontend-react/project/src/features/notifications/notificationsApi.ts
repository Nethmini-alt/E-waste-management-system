import { api } from '../../api/client';

/** Severity as stored by the API: "info" | "success" | "warning" | "error". */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/** One in-app notification from GET /api/notifications. */
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  /** In-app route to open when the notification is clicked (may be null). */
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

interface UnreadCountResponse {
  count: number;
}

// Uses the shared client so the JWT is attached — every notifications
// endpoint is scoped to the logged-in user by the token, never by a query arg.
export const notificationsApi = {
  /** The logged-in user's notifications, newest first. */
  list: (limit = 20) =>
    api.get<AppNotification[]>('/api/notifications', { params: { limit } }).then((r) => r.data),

  /** Cheap poll target for the bell badge. */
  unreadCount: () =>
    api.get<UnreadCountResponse>('/api/notifications/unread-count').then((r) => r.data.count),

  /** Mark one notification read. Resolves false when it no longer exists. */
  markRead: (id: string) =>
    api
      .post<void>(`/api/notifications/${id}/read`)
      .then(() => true)
      .catch(() => false),

  /** Mark every unread notification read; returns the remaining count (0). */
  markAllRead: () =>
    api.post<UnreadCountResponse>('/api/notifications/read-all').then((r) => r.data.count),
};
