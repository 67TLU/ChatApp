import { NotificationRepository } from './notification.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { Server as SocketServer } from 'socket.io';

export class NotificationService {
  private repo = new NotificationRepository();
  private io: SocketServer | null = null;

  setIO(io: SocketServer) {
    this.io = io;
  }

  /** Tạo notification + emit realtime (nếu user đang online) */
  async createAndEmit(data: {
    userId: string;
    type: string;
    title: string;
    body?: string;
    iconUrl?: string;
    actionUrl?: string;
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
  }) {
    const notification = await this.repo.create(data);

    // Emit realtime nếu user đang online
    if (this.io) {
      this.io.to(`user:${data.userId}`).emit('notification:new', {
        ...notification,
        actor: data.actorId ? { id: data.actorId } : null,
      });
    }

    return notification;
  }

  async getUserNotifications(userId: string, options: {
    unreadOnly?: boolean;
    cursor?: string;
    limit?: number;
  } = {}) {
    return this.repo.getUserNotifications(userId, options);
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.repo.findById(notificationId);
    if (!notification) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Thông báo không tồn tại');
    }
    if (notification.userId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    const updated = await this.repo.markAsRead(notificationId, userId);
    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.repo.markAllAsRead(userId);
    return { success: true };
  }

  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.repo.findById(notificationId);
    if (!notification) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Thông báo không tồn tại');
    }
    if (notification.userId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    await this.repo.deleteNotification(notificationId, userId);
    return { success: true };
  }

  async getUnreadCount(userId: string) {
    const count = await this.repo.countUnread(userId);
    return { unreadCount: count };
  }

  // ===== Helper: Các loại notification thường gặp =====

  async notifyFriendRequest(data: {
    toUserId: string;
    fromUserId: string;
    fromUsername: string;
    fromDisplayName?: string;
    fromAvatarUrl?: string;
  }) {
    return this.createAndEmit({
      userId: data.toUserId,
      type: 'FRIEND_REQUEST',
      title: 'Lời mời kết bạn',
      body: `${data.fromDisplayName || data.fromUsername} muốn kết bạn với bạn`,
      iconUrl: data.fromAvatarUrl,
      actionUrl: `/friends/requests`,
      resourceType: 'USER',
      resourceId: data.fromUserId,
      actorId: data.fromUserId,
    });
  }

  async notifyFriendAccepted(data: {
    toUserId: string;
    fromUserId: string;
    fromUsername: string;
    fromDisplayName?: string;
    fromAvatarUrl?: string;
  }) {
    return this.createAndEmit({
      userId: data.toUserId,
      type: 'FRIEND_ACCEPTED',
      title: 'Bạn bè mới',
      body: `${data.fromDisplayName || data.fromUsername} đã chấp nhận lời mời kết bạn`,
      iconUrl: data.fromAvatarUrl,
      actionUrl: `/friends`,
      resourceType: 'USER',
      resourceId: data.fromUserId,
      actorId: data.fromUserId,
    });
  }

  async notifyMention(data: {
    toUserId: string;
    fromUserId: string;
    fromDisplayName: string;
    conversationId: string;
    messageId: string;
    preview: string;
  }) {
    return this.createAndEmit({
      userId: data.toUserId,
      type: 'MENTION',
      title: `${data.fromDisplayName} nhắc đến bạn`,
      body: data.preview,
      actionUrl: `/conversations/${data.conversationId}?message=${data.messageId}`,
      resourceType: 'MESSAGE',
      resourceId: data.messageId,
      actorId: data.fromUserId,
    });
  }

  async notifyCallMissed(data: {
    toUserId: string;
    fromUserId: string;
    fromDisplayName: string;
    fromAvatarUrl?: string;
    callId: string;
    callType: 'VOICE' | 'VIDEO';
  }) {
    return this.createAndEmit({
      userId: data.toUserId,
      type: 'CALL_MISSED',
      title: `Cuộc gọi ${data.callType === 'VIDEO' ? 'video' : 'thoại'} nhỡ`,
      body: `Từ ${data.fromDisplayName}`,
      iconUrl: data.fromAvatarUrl,
      actionUrl: `/calls/${data.callId}`,
      resourceType: 'CALL',
      resourceId: data.callId,
      actorId: data.fromUserId,
    });
  }

  async notifyGroupInvite(data: {
    toUserId: string;
    fromUserId: string;
    fromDisplayName: string;
    groupId: string;
    groupName: string;
  }) {
    return this.createAndEmit({
      userId: data.toUserId,
      type: 'GROUP_INVITE',
      title: 'Lời mời vào nhóm',
      body: `${data.fromDisplayName} mời bạn vào nhóm ${data.groupName}`,
      actionUrl: `/groups/${data.groupId}`,
      resourceType: 'GROUP',
      resourceId: data.groupId,
      actorId: data.fromUserId,
    });
  }
}

export const notificationService = new NotificationService();