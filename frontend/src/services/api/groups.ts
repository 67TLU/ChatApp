import { apiClient } from './client';
import type { Group } from '@/types/group';

export const groupsApi = {
  create: (data: { name: string; description?: string; memberIds: string[] }) =>
    apiClient.post<{ success: boolean; data: { groupId: string; conversationId: string; name: string } }>(
      '/groups',
      data
    ),

  detail: (groupId: string) =>
    apiClient.get<{ success: boolean; data: Group }>(`/groups/${groupId}`),

  byConversation: (conversationId: string) =>
    apiClient.get<{ success: boolean; data: Group }>(`/groups/by-conversation/${conversationId}`),

  update: (groupId: string, data: { name?: string; description?: string }) =>
    apiClient.patch<{ success: boolean; data: Group }>(`/groups/${groupId}`, data),

  remove: (groupId: string) =>
    apiClient.delete(`/groups/${groupId}`),

  leave: (groupId: string) =>
    apiClient.post(`/groups/${groupId}/leave`),

  addMember: (groupId: string, userId: string) =>
    apiClient.post(`/groups/${groupId}/members`, { userId }),

  kickMember: (groupId: string, userId: string) =>
    apiClient.post(`/groups/${groupId}/members/kick`, { userId }),

  banMember: (groupId: string, userId: string, reason?: string) =>
    apiClient.post(`/groups/${groupId}/members/ban`, { userId, reason }),

  unbanMember: (groupId: string, userId: string) =>
    apiClient.delete(`/groups/${groupId}/members/${userId}/ban`),

  createInvite: (groupId: string, data: { maxUses?: number } = {}) =>
    apiClient.post<{ success: boolean; data: { inviteId: string; inviteCode: string; inviteUrl: string } }>(
      `/groups/${groupId}/invites`,
      data
    ),

  joinByCode: (code: string) =>
    apiClient.post<{ success: boolean; data: { groupId: string; groupName: string } }>(
      '/groups/join',
      { code }
    ),
};