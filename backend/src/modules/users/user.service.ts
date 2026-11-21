import { UserRepository } from './user.repository';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { hashPassword, verifyPassword } from '@/common/utils/password';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

export class UserService {
  private userRepo = new UserRepository();
  private authRepo = new AuthRepository();

  async getProfile(userId: string, requesterId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user || user.status === 'DELETED') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }

    // Nếu xem profile của chính mình → trả đầy đủ
    if (userId === requesterId) {
      return {
        ...user,
        isSelf: true,
      };
    }

    // Nếu xem người khác → ẩn email
    const { email, ...publicProfile } = user;
    return {
      ...publicProfile,
      isSelf: false,
    };
  }

  async updateProfile(userId: string, data: {
    displayName?: string;
    bio?: string;
    customStatus?: string;
  }) {
    if (data.displayName !== undefined && data.displayName.trim().length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Tên hiển thị không được để trống');
    }

    const updated = await this.userRepo.updateProfile(userId, data);
    return updated;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.userRepo.updateAvatar(userId, avatarUrl);
    return { avatarUrl };
  }

  async updateCover(userId: string, coverUrl: string) {
    await this.userRepo.updateCover(userId, coverUrl);
    return { coverUrl };
  }

  async searchUsers(query: string, currentUserId: string, limit = 20) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    return this.userRepo.searchUsers(query.trim(), currentUserId, limit);
  }

  async changePassword(userId: string, data: {
    currentPassword: string;
    newPassword: string;
  }) {
    if (data.newPassword.length < 6) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Mật khẩu mới ít nhất 6 ký tự');
    }

    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }

    const isValid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 'Mật khẩu hiện tại không đúng');
    }

    const newHash = await hashPassword(data.newPassword);
    await this.userRepo.changePassword(userId, newHash);

    // Revoke tất cả sessions khác (giữ session hiện tại)
    await this.authRepo.revokeAllUserSessions(userId);

    return { message: 'Mật khẩu đã được thay đổi. Vui lòng đăng nhập lại trên các thiết bị khác.' };
  }

  async getSettings(userId: string) {
    return this.userRepo.getSettings(userId);
  }

  async updateSettings(userId: string, data: {
    defaultPresence?: string;
    showLastSeen?: string;
    notifyFriendRequest?: string;
    notifyMessage?: string;
    notifyCall?: string;
  }) {
    const updated = await this.userRepo.updateSettings(userId, data);
    return updated;
  }
}