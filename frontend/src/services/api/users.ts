import { apiClient } from './client';

export interface UserProfile {
  id: string;
  email?: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  customStatus: string | null;
  presenceStatus: string;
  isSelf: boolean;
}

export interface UserSettings {
  userId: string;
  defaultPresence: string;
  customStatus: string | null;
  showLastSeen: string;
  notifyFriendRequest: string;
  notifyMessage: string;
  notifyCall: string;
}

export const usersApi = {
  getMe: () =>
    apiClient.get<{ success: boolean; data: UserProfile }>('/users/me'),

  getUser: (id: string) =>
    apiClient.get<{ success: boolean; data: UserProfile }>(`/users/${id}`),

  updateProfile: (data: {
    displayName?: string;
    bio?: string;
    customStatus?: string;
  }) => apiClient.patch('/users/me', data),

  updateAvatar: (avatarUrl: string) =>
    apiClient.patch('/users/me/avatar', { avatarUrl }),

  updateCover: (coverUrl: string) =>
    apiClient.patch('/users/me/cover', { coverUrl }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.post('/users/me/change-password', data),

  getSettings: () =>
    apiClient.get<{ success: boolean; data: UserSettings }>('/users/me/settings'),

  updateSettings: (data: Partial<UserSettings>) =>
    apiClient.patch('/users/me/settings', data),

  searchUsers: (q: string, limit = 20) =>
    apiClient.get(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};