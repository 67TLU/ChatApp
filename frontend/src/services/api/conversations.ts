import { apiClient } from './client';
import type { Conversation } from '@/types/chat';

export const conversationsApi = {
  list: (limit = 50, offset = 0) =>
    apiClient.get<{ success: boolean; data: Conversation[] }>(
      `/conversations?limit=${limit}&offset=${offset}`
    ),

  detail: (id: string) =>
    apiClient.get<{ success: boolean; data: Conversation }>(`/conversations/${id}`),

  createDirect: (userId: string) =>
    apiClient.post<{ success: boolean; data: { conversationId: string; isNew: boolean } }>(
      '/conversations/direct',
      { userId }
    ),

  markRead: (id: string, lastMessageId: string) =>
    apiClient.post(`/conversations/${id}/read`, { lastMessageId }),
};