import { ConversationRepository } from './conversation.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { FriendshipRepository } from '@/modules/friendships/friendship.repository';

export class ConversationService {
  private repo = new ConversationRepository();
  private friendshipRepo = new FriendshipRepository();

  async getOrCreateDirectConversation(userId: string, otherUserId: string) {
    // Không thể chat với chính mình
    if (userId === otherUserId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể chat với chính mình');
    }

    // Kiểm tra block
    const isBlocked = await this.friendshipRepo.isBlockedEitherWay(userId, otherUserId);
    if (isBlocked) {
      throw new AppError(ErrorCodes.BLOCKED_USER, 'Không thể chat với người dùng này');
    }

    // Tìm conversation đã tồn tại
    const existing = await this.repo.findDirectConversation(userId, otherUserId);
    if (existing) {
      return { conversationId: existing, isNew: false };
    }

    // Tạo mới
    const conv = await this.repo.createDirectConversation(userId, otherUserId);
    return { conversationId: conv.id, isNew: true };
  }

  async createGroupConversation(userId: string, data: {
    name: string;
    memberIds: string[];
    description?: string;
  }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Tên nhóm không được để trống');
    }

    if (data.memberIds.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cần ít nhất 1 thành viên');
    }

    // Không thêm chính mình
    const memberIds = data.memberIds.filter(id => id !== userId);
    if (memberIds.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Danh sách thành viên không hợp lệ');
    }

    // Kiểm tra trùng lặp: kiểm tra user đã là member nào khác chưa
    const allMemberIds = [userId, ...memberIds];
    const uniqueMemberIds = [...new Set(allMemberIds)];
    if (uniqueMemberIds.length !== allMemberIds.length) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Danh sách thành viên chứa trùng lặp');
    }

    const conv = await this.repo.createGroupConversation({
      name: data.name.trim(),
      ownerId: userId,
      memberIds,
      description: data.description,
    });

    return {
      conversationId: conv.id,
      name: conv.name,
      members: uniqueMemberIds,
    };
  }

  async getUserConversations(userId: string, limit = 50, offset = 0) {
    return this.repo.getUserConversations(userId, limit, offset);
  }

  async getConversationDetails(userId: string, conversationId: string) {
    const conv = await this.repo.findById(conversationId);
    if (!conv || conv.deletedAt) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc trò chuyện không tồn tại');
    }

    // Kiểm tra quyền
    const isMember = await this.repo.isMember(conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền truy cập');
    }

    const members = await this.repo.getMembers(conversationId);
    const readState = await this.repo.getReadState(userId, conversationId);

    return {
      ...conv,
      members,
      unreadCount: readState?.unreadCount ?? 0,
      lastReadMessageId: readState?.lastReadMessageId,
    };
  }

  async markAsRead(userId: string, conversationId: string, lastMessageId: string) {
    const isMember = await this.repo.isMember(conversationId, userId);
    if (!isMember) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền truy cập');
    }

    await this.repo.updateReadState(userId, conversationId, {
      lastReadMessageId: lastMessageId,
      lastReadAt: new Date(),
    });

    return { success: true };
  }
}