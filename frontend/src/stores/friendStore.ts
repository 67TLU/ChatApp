import { create } from 'zustand';
import { friendsApi, type User, type Friendship, type FriendRequest, type Block } from '@/services/api/friends';
import { toast } from 'sonner';

interface FriendState {
  // Data
  friends: Friendship[];
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  blockedUsers: Block[];
  searchResults: User[];
  
  // Loading states
  isLoadingFriends: boolean;
  isLoadingRequests: boolean;
  isLoadingBlocks: boolean;
  isSearching: boolean;
  isSendingRequest: boolean;

  // Actions
   onFriendRequest: (data: any) => void;
  loadFriends: () => Promise<void>;
  loadReceivedRequests: () => Promise<void>;
  loadSentRequests: () => Promise<void>;
  loadBlockedUsers: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  sendFriendRequest: (userId: string, message?: string) => Promise<boolean>;
  acceptFriendRequest: (friendshipId: string) => Promise<boolean>;
  rejectFriendRequest: (friendshipId: string) => Promise<boolean>;
  cancelFriendRequest: (friendshipId: string) => Promise<boolean>;
  removeFriend: (friendshipId: string) => Promise<boolean>;
  blockUser: (userId: string, reason?: string) => Promise<boolean>;
  unblockUser: (userId: string) => Promise<boolean>;
  clearSearchResults: () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  receivedRequests: [],
  sentRequests: [],
  blockedUsers: [],
  searchResults: [],
  
  isLoadingFriends: false,
  isLoadingRequests: false,
  isLoadingBlocks: false,
  isSearching: false,
  isSendingRequest: false,

  onFriendRequest: (data) => {
    get().loadReceivedRequests();
  },

  loadFriends: async () => {
    set({ isLoadingFriends: true });
    try {
      const res = await friendsApi.getFriends();
      set({ friends: res.data.data });
    } catch (error) {
      toast.error('Không thể tải danh sách bạn bè');
    } finally {
      set({ isLoadingFriends: false });
    }
  },

  loadReceivedRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      const res = await friendsApi.getReceivedRequests();
      set({ receivedRequests: res.data.data });
    } catch (error) {
      toast.error('Không thể tải lời mời');
    } finally {
      set({ isLoadingRequests: false });
    }
  },

  loadSentRequests: async () => {
    try {
      const res = await friendsApi.getSentRequests();
      set({ sentRequests: res.data.data });
    } catch (error) {
      toast.error('Không thể tải lời mời đã gửi');
    }
  },

  loadBlockedUsers: async () => {
    set({ isLoadingBlocks: true });
    try {
      const res = await friendsApi.getBlockedList();
      set({ blockedUsers: res.data.data });
    } catch (error) {
      toast.error('Không thể tải danh sách chặn');
    } finally {
      set({ isLoadingBlocks: false });
    }
  },

  searchUsers: async (query: string) => {
    if (query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearching: true });
    try {
      const res = await friendsApi.searchUsers(query);
      set({ searchResults: res.data.data });
    } catch (error) {
      toast.error('Không thể tìm kiếm');
    } finally {
      set({ isSearching: false });
    }
  },

  sendFriendRequest: async (userId: string, message?: string) => {
    set({ isSendingRequest: true });
    try {
      const res = await friendsApi.sendRequest(userId, message);
      toast.success(res.data.data.message || 'Đã gửi lời mời kết bạn');
      // Reload sent requests
      await get().loadSentRequests();
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể gửi lời mời';
      toast.error(msg);
      return false;
    } finally {
      set({ isSendingRequest: false });
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    try {
      await friendsApi.acceptRequest(friendshipId);
      toast.success('Đã chấp nhận lời mời kết bạn');
      // Reload data
      await Promise.all([
        get().loadFriends(),
        get().loadReceivedRequests(),
      ]);
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể chấp nhận';
      toast.error(msg);
      return false;
    }
  },

  rejectFriendRequest: async (friendshipId: string) => {
    try {
      await friendsApi.rejectRequest(friendshipId);
      toast.success('Đã từ chối lời mời');
      await get().loadReceivedRequests();
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể từ chối';
      toast.error(msg);
      return false;
    }
  },

  cancelFriendRequest: async (friendshipId: string) => {
    try {
      await friendsApi.cancelRequest(friendshipId);
      toast.success('Đã hủy lời mời');
      await get().loadSentRequests();
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể hủy';
      toast.error(msg);
      return false;
    }
  },

  removeFriend: async (friendshipId: string) => {
    try {
      await friendsApi.removeFriend(friendshipId);
      toast.success('Đã hủy kết bạn');
      await get().loadFriends();
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể hủy kết bạn';
      toast.error(msg);
      return false;
    }
  },

  blockUser: async (userId: string, reason?: string) => {
    try {
      await friendsApi.blockUser(userId, reason);
      toast.success('Đã chặn người dùng');
      await Promise.all([
        get().loadBlockedUsers(),
        get().loadFriends(), // Remove from friends if exists
      ]);
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể chặn';
      toast.error(msg);
      return false;
    }
  },

  unblockUser: async (userId: string) => {
    try {
      await friendsApi.unblockUser(userId);
      toast.success('Đã bỏ chặn');
      await get().loadBlockedUsers();
      return true;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || 'Không thể bỏ chặn';
      toast.error(msg);
      return false;
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),
}));