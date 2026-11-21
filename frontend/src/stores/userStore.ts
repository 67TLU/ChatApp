import { create } from 'zustand';
import { toast } from 'sonner';
import { usersApi, type UserProfile, type UserSettings } from '@/services/api/users';
import { useAuthStore } from './authStore';

interface UserState {
  profile: UserProfile | null;
  settings: UserSettings | null;
  isLoadingProfile: boolean;
  isLoadingSettings: boolean;
 onPresenceChanged: (data: any) => void;
  loadProfile: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateProfile: (data: { displayName?: string; bio?: string; customStatus?: string }) => Promise<boolean>;
  updateAvatar: (url: string) => Promise<boolean>;
  updateCover: (url: string) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  updateSettings: (data: Partial<UserSettings>) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  settings: null,
  isLoadingProfile: false,
  isLoadingSettings: false,

  onPresenceChanged: (data) => {
    set((s) => {
      if (!s.profile || s.profile.id !== data.userId) return s;
      return { profile: { ...s.profile, presenceStatus: data.status } };
    });
  },

  loadProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const res = await usersApi.getMe();
      set({ profile: res.data.data });
      // Sync với authStore
      useAuthStore.getState().setUser(res.data.data as any);
    } catch {
      toast.error('Không thể tải thông tin cá nhân');
    } finally {
      set({ isLoadingProfile: false });
    }
  },

  loadSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const res = await usersApi.getSettings();
      set({ settings: res.data.data });
    } catch {
      toast.error('Không thể tải cài đặt');
    } finally {
      set({ isLoadingSettings: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await usersApi.updateProfile(data);
      set({ profile: res.data.data });
      toast.success('Đã cập nhật thông tin');
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Cập nhật thất bại');
      return false;
    }
  },

  updateAvatar: async (url) => {
    try {
      await usersApi.updateAvatar(url);
      set((s) => s.profile ? { profile: { ...s.profile, avatarUrl: url } } : {});
      toast.success('Đã cập nhật avatar');
      return true;
    } catch {
      toast.error('Cập nhật avatar thất bại');
      return false;
    }
  },

  updateCover: async (url) => {
    try {
      await usersApi.updateCover(url);
      set((s) => s.profile ? { profile: { ...s.profile, coverUrl: url } } : {});
      toast.success('Đã cập nhật ảnh bìa');
      return true;
    } catch {
      toast.error('Cập nhật ảnh bìa thất bại');
      return false;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      await usersApi.changePassword({ currentPassword, newPassword });
      toast.success('Đã đổi mật khẩu. Vui lòng đăng nhập lại trên các thiết bị khác.');
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message || 'Đổi mật khẩu thất bại');
      return false;
    }
  },

  updateSettings: async (data) => {
    try {
      const res = await usersApi.updateSettings(data);
      set({ settings: res.data.data });
      toast.success('Đã cập nhật cài đặt');
      return true;
    } catch {
      toast.error('Cập nhật cài đặt thất bại');
      return false;
    }
  },
}));