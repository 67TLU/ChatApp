import { MessageRepository } from './message.repository';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { FriendshipRepository } from '@/modules/friendships/friendship.repository';

export class MessageService {
  private messageRepo = new MessageRepository();
  private convRepo = new ConversationRepository();
  private friendshipRepo = new FriendshipRepository();

  async getMessages(userId: string, conversationId: string, cursor?: string, limit = 50) {
    // Check permission
    const isMember = await this.convRepo.isMember(conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền truy cập');
    }

    const messages = await this.messageRepo.getMessages(conversationId, { cursor, limit });

    // Load attachments + reactions bằng batch để tránh N+1 query
    const messageIds = messages.map(m => m.id);
    const [attachments, reactions] = await Promise.all([
      // Batch load attachments - single query nếu DB hỗ trợ, otherwise map
      messageIds.length > 0 ? this.messageRepo.getAttachmentsBatch(messageIds) : [],
      this.messageRepo.getReactions(messageIds),
    ]);

    // Group attachments by messageId
    const attachmentsMap = new Map<string, any[]>();
    messageIds.forEach((id, idx) => {
      attachmentsMap.set(id, attachments[idx] as any);
    });

    // Group reactions by messageId
    const reactionsMap = new Map<string, Map<string, { count: number; users: any[] }>>();
    for (const r of reactions) {
      if (!reactionsMap.has(r.messageId)) {
        reactionsMap.set(r.messageId, new Map());
      }
      const emojiMap = reactionsMap.get(r.messageId)!;
      if (!emojiMap.has(r.emoji)) {
        emojiMap.set(r.emoji, { count: 0, users: [] });
      }
      const emojiData = emojiMap.get(r.emoji)!;
      emojiData.count++;
      emojiData.users.push({
        userId: r.userId,
        username: r.username,
        displayName: r.displayName,
      });
    }

    // Format messages
    const formatted = messages.map(m => ({
      ...m,
      attachments: attachmentsMap.get(m.id) || [],
      reactions: reactionsMap.get(m.id) 
        ? Array.from(reactionsMap.get(m.id)!.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            users: data.users,
          }))
        : [],
      sender: {
        id: m.senderId,
        username: m.senderUsername,
        displayName: m.senderDisplayName,
        avatarUrl: m.senderAvatarUrl,
      },
    }));

    return {
      messages: formatted,
      hasMore: formatted.length === limit,
      nextCursor: formatted.length > 0 ? formatted[formatted.length - 1].id : null,
    };
  }

  async sendMessage(userId: string, data: {
    conversationId: string;
    clientMessageId?: string;
    content?: string;
    messageType?: string;
    replyToMessageId?: string;
    attachmentIds?: string[];
  }) {
    // Validate
    if (!data.content && (!data.attachmentIds || data.attachmentIds.length === 0)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Tin nhắn không được để trống');
    }

    // Check permission - là member của conversation
    const isMember = await this.convRepo.isMember(data.conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền gửi tin nhắn');
    }

    // Kiểm tra user bị chặn không (nếu đối tác là recipient trong conversation)
    // Lấy thông tin conversation để biết recipient
    const conv = await this.convRepo.findById(data.conversationId);
    if (conv) {
      // Nếu conversation là DIRECT, tìm user kia
      if (conv.type === 'DIRECT') {
        const otherMember = await this.convRepo.getMember(data.conversationId, userId);
        // Lấy member khác
        const allMembers = await this.convRepo.getMembers(data.conversationId);
        const recipientId = allMembers.find(m => m.userId !== userId)?.userId;
        if (recipientId) {
          // Kiểm tra xem user có bị chặn bởi recipient không
          const isBlocked = await this.friendshipRepo.isBlockedEitherWay(userId, recipientId);
          if (isBlocked) {
            throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn bị người này chặn và không thể gửi tin nhắn');
          }
        }
      }
      // cho GROUP, có thể check admin/moderator permissions khác
    }

    if (!conv || conv.isLocked) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cuộc trò chuyện đã bị khóa');
    }

    // Check duplicate (client retry)
    if (data.clientMessageId) {
      const existing = await this.messageRepo.findByClientId(data.clientMessageId);
      if (existing) {
        return { message: existing, isDuplicate: true };
      }
    }

    // Create message
    const message = await this.messageRepo.createMessage({
      conversationId: data.conversationId,
      senderId: userId,
      clientMessageId: data.clientMessageId,
      content: data.content,
      messageType: data.messageType || 'TEXT',
      replyToMessageId: data.replyToMessageId,
    });

    // Update conversation last message
    const preview = data.content?.substring(0, 100) || '[File đính kèm]';
    await this.convRepo.updateLastMessage(data.conversationId, {
      messageId: message.id,
      senderId: userId,
      preview,
    });

    // Increment unread count cho các members khác
    await this.convRepo.incrementUnreadCount(data.conversationId, userId);

    return { message, isDuplicate: false };
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tin nhắn không tồn tại');
    }

    if (message.senderId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn chỉ có thể sửa tin nhắn của mình');
    }

    if (message.status === 'DELETED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể sửa tin nhắn đã xóa');
    }

    const updated = await this.messageRepo.editMessage(messageId, content);
    return updated;
  }

  async deleteMessage(userId: string, messageId: string, deleteFor: 'ME' | 'EVERYONE' = 'ME') {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tin nhắn không tồn tại');
    }

    // Chỉ có chủ tin nhắn hoặc admin mới có thể xóa
    if (message.senderId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn chỉ có thể xóa tin nhắn của mình');
    }

    // Xóa theo phạm vi: 'ME' = chỉ xóa cho người gửi, 'EVERYONE' = xóa cho tất cả
    const deleted = await this.messageRepo.softDeleteMessage(messageId, userId, deleteFor);
    return deleted;
  }

  async addReaction(userId: string, messageId: string, emoji: string) {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tin nhắn không tồn tại');
    }

    const isMember = await this.convRepo.isMember(message.conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    const reaction = await this.messageRepo.addReaction(messageId, userId, emoji);
    return reaction;
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    await this.messageRepo.removeReaction(messageId, userId, emoji);
    return { success: true };
  }

  async pinMessage(userId: string, messageId: string) {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tin nhắn không tồn tại');
    }

    // Kiểm tra user là member của conversation
    const isMember = await this.convRepo.isMember(message.conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền pin tin nhắn');
    }

    const pin = await this.messageRepo.pinMessage(message.id, message.conversationId, userId);
    return pin;
  }

  async unpinMessage(userId: string, messageId: string) {
    const message = await this.messageRepo.findById(messageId);
    if (!message) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Tin nhắn không tồn tại');
    }

    // Kiểm tra user là member của conversation
    const isMember = await this.convRepo.isMember(message.conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền unpin tin nhắn');
    }

    await this.messageRepo.unpinMessage(messageId);
    return { success: true };
  }

  async getPins(userId: string, conversationId: string) {
    const isMember = await this.convRepo.isMember(conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    return this.messageRepo.getPins(conversationId);
  }

  async markAsRead(userId: string, conversationId: string) {
    const isMember = await this.convRepo.isMember(conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    const latest = await this.messageRepo.getLatestMessageId(conversationId);

    await this.messageRepo.markConversationRead(conversationId, userId);
    if (latest) {
      await this.convRepo.updateReadState(userId, conversationId, {
        lastReadMessageId: latest,
        lastReadAt: new Date(),
      });
    }
    return { success: true, lastReadMessageId: latest };
  }
}