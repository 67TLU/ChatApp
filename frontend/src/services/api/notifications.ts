import { apiClient } from './client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  iconUrl: string | null;
  actionUrl: string | null;
  resourceType: string | null;
  resourceId: string | null;
  actorId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  actorUsername: string | null;
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
}

export const notificationsApi = {
  list: (options: { unreadOnly?: boolean; cursor?: string; limit?: number } = {}) =>
    apiClient.get<{ success: boolean; data: Notification[] }>('/notifications', {
      params: options,
    }),

  unreadCount: () =>
    apiClient.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count'),

  markAsRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllAsRead: () =>
    apiClient.post('/notifications/read-all'),

  delete: (id: string) =>
    apiClient.delete(`/notifications/${id}`),
};