import { apiClient } from './client';
export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface User {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  presenceStatus: string;
}

export interface Friendship {
  friendshipId: string;
  createdAt: string;
  friend: User;
}

export interface FriendRequest {
  friendshipId: string;
  requesterId?: string;
  addresseeId?: string;
  message: string | null;
  createdAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Block {
  blockedId: string;
  reason: string | null;
  blockedAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export const friendsApi = {
  // ===== FRIENDSHIPS =====
  
  getFriends: (limit = 50, offset = 0) =>
    apiClient.get<ApiResponse<Friendship[]>>(`/friends?limit=${limit}&offset=${offset}`),

   getReceivedRequests: () =>
    apiClient.get<ApiResponse<FriendRequest[]>>('/friends/requests/received'),
  getSentRequests: () =>
    apiClient.get<ApiResponse<FriendRequest[]>>('/friends/requests/sent'),
  getRelationship: (userId: string) =>
    apiClient.get(`/friends/relationship/${userId}`),

  sendRequest: (addresseeId: string, message?: string) =>
    apiClient.post('/friends/request', { addresseeId, message }),

  acceptRequest: (friendshipId: string) =>
    apiClient.post(`/friends/accept/${friendshipId}`),

  rejectRequest: (friendshipId: string) =>
    apiClient.post(`/friends/reject/${friendshipId}`),

  cancelRequest: (friendshipId: string) =>
    apiClient.post(`/friends/cancel/${friendshipId}`),

  removeFriend: (friendshipId: string) =>
    apiClient.delete(`/friends/${friendshipId}`),

  // ===== BLOCKS =====

   getBlockedList: () =>
    apiClient.get<ApiResponse<Block[]>>('/friends/blocks'),
  blockUser: (userId: string, reason?: string) =>
    apiClient.post('/friends/blocks', { userId, reason }),

  unblockUser: (userId: string) =>
    apiClient.delete(`/friends/blocks/${userId}`),

  // ===== SEARCH =====

   searchUsers: (query: string, limit = 20) =>
    apiClient.get<ApiResponse<User[]>>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};