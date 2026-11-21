import { Server, Socket } from 'socket.io';
import { notificationService } from '@/modules/notifications/notification.service';

export class NotificationHandler {
  private socket: Socket;
  private io: Server;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
  }

  register() {
    // Client yêu cầu đánh dấu đã đọc
    this.socket.on('notification:mark-read', async (data: { notificationId: string }) => {
      try {
        await notificationService.markAsRead(this.socket.data.userId, data.notificationId);
        this.socket.emit('notification:read-confirm', { notificationId: data.notificationId });
      } catch (error) {
        // silent
      }
    });

    // Client yêu cầu đánh dấu tất cả đã đọc
    this.socket.on('notification:mark-all-read', async () => {
      try {
        await notificationService.markAllAsRead(this.socket.data.userId);
        this.socket.emit('notification:all-read-confirm', {});
      } catch (error) {
        // silent
      }
    });

    // Gửi unread count khi connect (để badge hiển thị đúng)
    this.socket.on('notification:get-unread', async () => {
      try {
        const { unreadCount } = await notificationService.getUnreadCount(this.socket.data.userId);
        this.socket.emit('notification:unread-count', { unreadCount });
      } catch (error) {
        // silent
      }
    });
  }
}