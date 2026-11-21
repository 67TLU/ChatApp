import { create } from 'zustand';
import { toast } from 'sonner';
import { groupsApi } from '@/services/api/groups';
import { useChatStore } from './chatStore';
import type { Group } from '@/types/group';

interface GroupState {
  currentGroup: Group | null;
  isLoadingGroup: boolean;

  loadGroupByConversation: (conversationId: string) => Promise<void>;
  clearCurrentGroup: () => void;
  createGroup: (data: { name: string; description?: string; memberIds: string[] }) => Promise<string | null>;
  updateGroup: (groupId: string, data: { name?: string; description?: string }) => Promise<boolean>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  addMember: (groupId: string, userId: string) => Promise<boolean>;
  kickMember: (groupId: string, userId: string) => Promise<boolean>;
  banMember: (groupId: string, userId: string) => Promise<boolean>;
  createInvite: (groupId: string) => Promise<string | null>;
  joinByCode: (code: string) => Promise<boolean>;
}

const getErrorMsg = (e: any, fallback: string) =>
  e?.response?.data?.error?.message ?? fallback;

export const useGroupStore = create<GroupState>((set) => ({
  currentGroup: null,
  isLoadingGroup: false,

  loadGroupByConversation: async (conversationId) => {
    set({ isLoadingGroup: true });
    try {
      const res = await groupsApi.byConversation(conversationId);
      set({ currentGroup: res.data.data });
    } catch {
      set({ currentGroup: null });
    } finally {
      set({ isLoadingGroup: false });
    }
  },

  clearCurrentGroup: () => set({ currentGroup: null }),

  createGroup: async (data) => {
    try {
      const res = await groupsApi.create(data);
      toast.success(`Nhóm "${res.data.data.name}" đã được tạo`);
      await useChatStore.getState().loadConversations();
      return res.data.data.conversationId;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không tạo được nhóm'));
      return null;
    }
  },

  updateGroup: async (groupId, data) => {
    try {
      const res = await groupsApi.update(groupId, data);
      set({ currentGroup: res.data.data });
      toast.success('Đã cập nhật thông tin nhóm');
      // Đồng bộ tên nhóm ở sidebar
      await useChatStore.getState().loadConversations();
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không cập nhật được nhóm'));
      return false;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await groupsApi.remove(groupId);
      toast.success('Đã xóa nhóm');
      await useChatStore.getState().loadConversations();
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không xóa được nhóm'));
      return false;
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await groupsApi.leave(groupId);
      toast.success('Bạn đã rời nhóm');
      await useChatStore.getState().loadConversations();
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không rời được nhóm'));
      return false;
    }
  },

  addMember: async (groupId, userId) => {
    try {
      await groupsApi.addMember(groupId, userId);
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không thêm được thành viên'));
      return false;
    }
  },

  kickMember: async (groupId, userId) => {
    try {
      await groupsApi.kickMember(groupId, userId);
      toast.success('Đã kick thành viên');
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không kick được thành viên'));
      return false;
    }
  },

  banMember: async (groupId, userId) => {
    try {
      await groupsApi.banMember(groupId, userId);
      toast.success('Đã ban thành viên');
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không ban được thành viên'));
      return false;
    }
  },

  createInvite: async (groupId) => {
    try {
      const res = await groupsApi.createInvite(groupId);
      return res.data.data.inviteCode;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không tạo được mã mời'));
      return null;
    }
  },

  joinByCode: async (code) => {
    try {
      const res = await groupsApi.joinByCode(code);
      toast.success(`Đã tham gia nhóm "${res.data.data.groupName}"`);
      await useChatStore.getState().loadConversations();
      return true;
    } catch (e: any) {
      toast.error(getErrorMsg(e, 'Không tham gia được nhóm'));
      return false;
    }
  },
}));