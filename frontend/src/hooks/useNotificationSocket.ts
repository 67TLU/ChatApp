import { useEffect } from 'react';
import { socketService } from '@/services/socket/socket';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import type { Notification } from '@/services/api/notifications';

export function useNotificationSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = socketService.getSocket();
      if (!socket) return false;

      const store = useNotificationStore.getState();

      const onNew = (notification: Notification) => store.onNewNotification(notification);
      const onRead = (data: { notificationId: string }) => store.onNotificationRead(data.notificationId);
      const onAllRead = () => store.onAllNotificationsRead();
      const onUnreadCount = (data: { unreadCount: number }) => {
        useNotificationStore.setState({ unreadCount: data.unreadCount });
      };

      socket.on('notification:new', onNew);
      socket.on('notification:read-confirm', onRead);
      socket.on('notification:all-read-confirm', onAllRead);
      socket.on('notification:unread-count', onUnreadCount);

      // Request unread count khi connect
      socket.emit('notification:get-unread');

      cleanup = () => {
        socket.off('notification:new', onNew);
        socket.off('notification:read-confirm', onRead);
        socket.off('notification:all-read-confirm', onAllRead);
        socket.off('notification:unread-count', onUnreadCount);
      };

      return true;
    };

    if (!attach()) {
      const timer = setInterval(() => {
        if (attach()) clearInterval(timer);
      }, 300);
      return () => {
        clearInterval(timer);
        cleanup?.();
      };
    }

    return () => cleanup?.();
  }, [isAuthenticated]);
}