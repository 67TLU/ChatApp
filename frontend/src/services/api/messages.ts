import { apiClient } from './client';
import type { Message } from '@/types/chat';

export interface MessagesPage {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

export const messagesApi = {
  list: (conversationId: string, cursor?: string, limit = 30) =>
    apiClient.get<{ success: boolean; data: MessagesPage }>(
      `/conversations/${conversationId}/messages`,
      { params: { cursor, limit } }
    ),

  send: (conversationId: string, body: {
    clientMessageId: string;
    content: string;
    replyToMessageId?: string;
  }) =>
    apiClient.post<{ success: boolean; data: { message: Message; isDuplicate: boolean } }>(
      `/conversations/${conversationId}/messages`,
      body
    ),

  edit: (messageId: string, content: string) =>
    apiClient.patch(`/messages/${messageId}`, { content }),

  remove: (messageId: string, deleteFor: 'ME' | 'EVERYONE' = 'EVERYONE') =>
    apiClient.delete(`/messages/${messageId}`, { data: { deleteFor } }),

  react: (messageId: string, emoji: string) =>
    apiClient.post(`/messages/${messageId}/reactions`, { emoji }),

  unreact: (messageId: string, emoji: string) =>
    apiClient.delete(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`),

  upload: (conversationId: string, files: File[], clientMessageId: string) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('clientMessageId', clientMessageId);
    return apiClient.post<{ success: boolean; data: { message: Message } }>(
      `/conversations/${conversationId}/upload`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};