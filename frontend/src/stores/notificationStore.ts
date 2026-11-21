import { create } from 'zustand';
import { toast } from 'sonner';
import { notificationsApi, type Notification } from '@/services/api/notifications';
import { socketService } from '@/services/socket/socket';

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  loadNotifications: (unreadOnly?: boolean) => Promise<void>;
  loadUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  
  // Socket handlers
  onNewNotification: (notification: Notification) => void;
  onNotificationRead: (id: string) => void;
  onAllNotificationsRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  loadNotifications: async (unreadOnly = false) => {
    set({ isLoading: true });
    try {
      const res = await notificationsApi.list({ unreadOnly, limit: 50 });
      set({ notifications: res.data.data });
    } catch {
      toast.error('Không thể tải thông báo');
    } finally {
      set({ isLoading: false });
    }
  },

  loadUnreadCount: async () => {
    try {
      const res = await notificationsApi.unreadCount();
      set({ unreadCount: res.data.data.unreadCount });
    } catch {
      // Silent
    }
  },

  markAsRead: async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      
      set((s) => ({
        notifications: s.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch {
      toast.error('Không thể đánh dấu đã đọc');
    }
  },

  markAllAsRead: async () => {
    try {
      await notificationsApi.markAllAsRead();
      socketService.emit('notification:mark-all-read');
      
      set((s) => ({
        notifications: s.notifications.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
      
      toast.success('Đã đánh dấu tất cả đã đọc');
    } catch {
      toast.error('Không thể đánh dấu đã đọc');
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await notificationsApi.delete(id);
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id),
      }));
    } catch {
      toast.error('Không thể xóa thông báo');
    }
  },

  onNewNotification: (notification) => {
    set((s) => ({
      notifications: [notification, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
    
    // Show toast
    toast(notification.title, {
      description: notification.body,
      icon: notification.iconUrl || undefined,
    });
  },

  onNotificationRead: (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
  },

  onAllNotificationsRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: new Date().toISOString(),
      })),
      unreadCount: 0,
    }));
  },
}));