import { AuthVerificationRepository } from './auth.verification.repository';
import { AuthRepository } from './auth.repository';
import { EmailService } from '@/infrastructure/email/email.service';
import { hashPassword } from '@/common/utils/password';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

export class AuthVerificationService {
  private verifyRepo = new AuthVerificationRepository();
  private authRepo = new AuthRepository();
  private emailService = new EmailService();

  // ===== EMAIL VERIFICATION =====

  async sendVerificationEmail(userId: string) {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }

    if (user.emailVerifiedAt) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Email đã được xác thực');
    }

    const tokenRow = await this.verifyRepo.createEmailVerificationToken(userId);

    await this.emailService.sendVerificationEmail(
      user.email,
      tokenRow.token,
      user.username
    );

    return { message: 'Email xác thực đã được gửi' };
  }

  async verifyEmail(token: string) {
    const tokenRow = await this.verifyRepo.findEmailToken(token);
    if (!tokenRow) {
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Token không hợp lệ hoặc đã hết hạn');
    }

    if (tokenRow.verifiedAt) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Token đã được sử dụng');
    }

    await this.verifyRepo.markEmailTokenUsed(tokenRow.id);
    await this.verifyRepo.markUserEmailVerified(tokenRow.userId);

    return { message: 'Email đã được xác thực thành công' };
  }

  // ===== FORGOT PASSWORD =====

  async forgotPassword(email: string) {
    const user = await this.authRepo.findUserByEmail(email);
    
    // ⭐ Không báo lỗi nếu email không tồn tại (chống leak thông tin)
    if (!user) {
      return { 
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu' 
      };
    }

    const tokenRow = await this.verifyRepo.createPasswordResetToken(user.id);

    await this.emailService.sendResetPasswordEmail(
      user.email,
      tokenRow.token,
      user.username
    );

    return { 
      message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu' 
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenRow = await this.verifyRepo.findResetToken(token);
    if (!tokenRow) {
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Token không hợp lệ hoặc đã hết hạn');
    }

    if (tokenRow.usedAt) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Token đã được sử dụng');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.verifyRepo.updateUserPassword(tokenRow.userId, passwordHash);
    await this.verifyRepo.markResetTokenUsed(tokenRow.id);

    // Revoke tất cả sessions hiện tại (bắt đăng nhập lại)
    const authRepo = new AuthRepository();
    await authRepo.revokeAllUserSessions(tokenRow.userId);

    return { message: 'Mật khẩu đã được đặt lại thành công' };
  }

  async validateResetToken(token: string) {
    const tokenRow = await this.verifyRepo.findResetToken(token);
    if (!tokenRow || tokenRow.usedAt) {
      return { valid: false };
    }
    return { valid: true };
  }
}