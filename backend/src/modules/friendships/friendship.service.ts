import { FriendshipRepository } from './friendship.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { db } from '@/infrastructure/database/connection';
import { users, friendships, blocks, userProfiles } from '@/infrastructure/database/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import { notificationService } from '@/modules/notifications/notification.service';
export class FriendshipService {
  private repo = new FriendshipRepository();

  async sendFriendRequest(
    requesterId: string,
    addresseeId: string,
    message?: string
  ) {
    // Không thể gửi cho chính mình
    if (requesterId === addresseeId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể gửi lời mời cho chính mình');
    }

    // Kiểm tra user tồn tại
    const addressee = await db.query.users.findFirst({
      where: eq(users.id, addresseeId),
    });
    if (!addressee || addressee.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }

    // Kiểm tra block (2 chiều)
    const isBlocked = await this.repo.isBlockedEitherWay(requesterId, addresseeId);
    if (isBlocked) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Không thể thực hiện hành động này');
    }

    // Kiểm tra đã là bạn chưa
    const existing = await this.repo.findFriendshipBetween(requesterId, addresseeId);
    
    if (existing) {
      if (existing.status === 'ACCEPTED') {
        throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Đã là bạn bè');
      }
      if (existing.status === 'PENDING') {
        // Nếu lời mời đang chờ là từ người khác → chấp nhận luôn
        if (existing.requesterId === addresseeId) {
          await this.repo.acceptFriendRequest(existing.id);
          return {
            action: 'ACCEPTED',
            friendshipId: existing.id,
            message: 'Đã tự động chấp nhận lời mời kết bạn',
          };
        }
        throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Đã gửi lời mời kết bạn');
      }
      if (existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
        // Có thể gửi lại - xóa lời mời cũ
        await this.repo.removeFriendship(existing.id);
      }
    }

    // Tạo lời mời mới
    const friendship = await this.repo.createFriendRequest({
      requesterId,
      addresseeId,
      message,
    });
const requester = await db.query.users.findFirst({ where: eq(users.id, requesterId) });
const requesterProfile = await db.query.userProfiles.findFirst({ 
  where: eq(userProfiles.userId, requesterId) 
});

await notificationService.notifyFriendRequest({
  toUserId: addresseeId,
  fromUserId: requesterId,
  fromUsername: requester!.username,
  fromDisplayName: requesterProfile?.displayName ?? undefined,
  fromAvatarUrl: requesterProfile?.avatarUrl ?? undefined,
});
    return {
      action: 'SENT',
      friendshipId: friendship.id,
      message: 'Đã gửi lời mời kết bạn',
    };
  }

  async acceptFriendRequest(userId: string, friendshipId: string) {
    const friendship = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });

    if (!friendship) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Lời mời không tồn tại');
    }

    if (friendship.addresseeId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền chấp nhận lời mời này');
    }

    if (friendship.status !== 'PENDING') {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Lời mời không còn hiệu lực');
    }

    // Kiểm tra block (có thể đã bị chặn sau khi gửi lời mời)
    const isBlocked = await this.repo.isBlockedEitherWay(
      friendship.requesterId,
      friendship.addresseeId
    );
    if (isBlocked) {
      throw new AppError(ErrorCodes.BLOCKED_USER, 'Không thể kết bạn');
    }

    await this.repo.acceptFriendRequest(friendshipId);

    // Lấy thông tin user để gửi notification
    const [user] = await db.select({
      username: users.username,
    }).from(users).where(eq(users.id, userId));

    const [profile] = await db.select({
      displayName: userProfiles.displayName,
      avatarUrl: userProfiles.avatarUrl,
    }).from(userProfiles).where(eq(userProfiles.userId, userId));

    await notificationService.notifyFriendAccepted({
      toUserId: friendship.requesterId,
      fromUserId: userId,
      fromUsername: user?.username || '',
      fromDisplayName: profile?.displayName ?? undefined,
      fromAvatarUrl: profile?.avatarUrl ?? undefined,
    });

    return {
      friendshipId,
      requesterId: friendship.requesterId,
      message: 'Đã chấp nhận lời mời kết bạn',
    };
  }

  async rejectFriendRequest(userId: string, friendshipId: string) {
    const friendship = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });

    if (!friendship) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Lời mời không tồn tại');
    }

    if (friendship.addresseeId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền từ chối lời mời này');
    }

    if (friendship.status !== 'PENDING') {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Lời mời không còn hiệu lực');
    }

    await this.repo.rejectFriendRequest(friendshipId);

    return { friendshipId, message: 'Đã từ chối lời mời kết bạn' };
  }

  async cancelFriendRequest(userId: string, friendshipId: string) {
    const friendship = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });

    if (!friendship) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Lời mời không tồn tại');
    }

    if (friendship.requesterId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền hủy lời mời này');
    }

    if (friendship.status !== 'PENDING') {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Lời mời không còn hiệu lực');
    }

    await this.repo.cancelFriendRequest(friendshipId);

    return { friendshipId, message: 'Đã hủy lời mời kết bạn' };
  }

  async removeFriend(userId: string, friendshipId: string) {
    const friendship = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });

    if (!friendship) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Quan hệ không tồn tại');
    }

    // Chỉ bạn bè mới có thể hủy kết bạn
    if (friendship.status !== 'ACCEPTED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Đây không phải quan hệ bạn bè');
    }

    // Một trong hai người đều có thể hủy
    if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền thực hiện hành động này');
    }
await this.repo.removeFriendship(friendshipId);
    return {
      friendshipId,
      friendId: friendship.requesterId === userId 
        ? friendship.addresseeId 
        : friendship.requesterId,
      message: 'Đã hủy kết bạn',
    };
  }

  async getFriendsList(userId: string, limit = 50, offset = 0) {
    return this.repo.getFriendsList(userId, limit, offset);
  }

  async getReceivedRequests(userId: string) {
    return this.repo.getReceivedRequests(userId);
  }

  async getSentRequests(userId: string) {
    return this.repo.getSentRequests(userId);
  }

  async getRelationshipStatus(userId1: string, userId2: string) {
    const friendship = await this.repo.findFriendshipBetween(userId1, userId2);
    
    if (!friendship) {
      // Kiểm tra block
      const block = await this.repo.findBlock(userId1, userId2);
      if (block) return { status: 'BLOCKED', direction: 'YOU_BLOCKED' };
      
      const reverseBlock = await this.repo.findBlock(userId2, userId1);
      if (reverseBlock) return { status: 'BLOCKED', direction: 'BLOCKED_BY' };
      
      return { status: 'NONE' };
    }

    if (friendship.status === 'ACCEPTED') {
      return { status: 'FRIENDS', friendshipId: friendship.id };
    }

    if (friendship.status === 'PENDING') {
      if (friendship.requesterId === userId1) {
        return { status: 'PENDING_SENT', friendshipId: friendship.id };
      }
      return { status: 'PENDING_RECEIVED', friendshipId: friendship.id };
    }

    return { status: friendship.status, friendshipId: friendship.id };
  }

  // ===== BLOCK =====

  async blockUser(blockerId: string, blockedId: string, reason?: string) {
    if (blockerId === blockedId) {
      throw new AppError(ErrorCodes.CANNOT_FRIEND_SELF, 'Không thể chặn chính mình');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, blockedId),
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }

    const existing = await this.repo.findBlock(blockerId, blockedId);
    if (existing) {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Đã chặn người dùng này');
    }

    // Tạo block
    await this.repo.createBlock(blockerId, blockedId, reason);

    // Tự động hủy kết bạn nếu có
    const friendship = await this.repo.findFriendshipBetween(blockerId, blockedId);
    if (friendship) {
      await this.repo.removeFriendship(friendship.id);
    }

    return { message: 'Đã chặn người dùng' };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    const existing = await this.repo.findBlock(blockerId, blockedId);
    if (!existing) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Chưa chặn người dùng này');
    }

    await this.repo.removeBlock(blockerId, blockedId);

    return { message: 'Đã bỏ chặn người dùng' };
  }

  async getBlockedList(userId: string) {
    return this.repo.getBlockedList(userId);
  }
}