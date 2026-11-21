import { AuthRepository } from './auth.repository';
import { hashPassword, verifyPassword } from '@/common/utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/common/utils/jwt';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { createHash } from 'crypto';
import { db } from '@/infrastructure/database/connection';
import { users } from '@/infrastructure/database/schema';
import { eq } from 'drizzle-orm';

export class AuthService {
  private repo = new AuthRepository();

  async register(data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) {
    // Check existing
    const existingEmail = await this.repo.findUserByEmail(data.email);
    if (existingEmail) {
      throw new AppError(ErrorCodes.EMAIL_ALREADY_EXISTS, 'Email đã được sử dụng');
    }

    const existingUsername = await this.repo.findUserByUsername(data.username);
    if (existingUsername) {
      throw new AppError(ErrorCodes.USERNAME_ALREADY_EXISTS, 'Username đã được sử dụng');
    }

    // Create user
    const passwordHash = await hashPassword(data.password);
    const user = await this.repo.createUser({
      email: data.email,
      username: data.username,
      passwordHash,
    });

    // Create profile + assign role
    await this.repo.createUserProfile(user.id, data.displayName);
    await this.repo.assignDefaultRole(user.id);

    return { userId: user.id, email: user.email };
  }

  async login(data: {
    email: string;
    password: string;
    deviceInfo?: {
      deviceType?: string;
      deviceName?: string;
      ipAddress?: string;
      userAgent?: string;
    };
  }) {
    // Find user
    const user = await this.repo.findUserByEmail(data.email);
    if (!user) {
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 'Email hoặc mật khẩu không đúng');
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.ACCOUNT_NOT_ACTIVE, 'Tài khoản chưa được kích hoạt');
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      throw new AppError(ErrorCodes.ACCOUNT_LOCKED, 'Tài khoản bị khóa tạm thời');
    }

    // Verify password
    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      await this.handleFailedLogin(user.id, user.failedLoginAttempts);
      throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 'Email hoặc mật khẩu không đúng');
    }

    // Reset failed attempts
    if (user.failedLoginAttempts > 0) {
      await this.resetFailedAttempts(user.id);
    }

    // Get roles
    const roles = await this.repo.getUserRoles(user.id);

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const refreshToken = signRefreshToken({
      userId: user.id,
    });

    // Create session
    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.repo.createSession({
      userId: user.id,
      refreshTokenHash,
      ...data.deviceInfo,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    // Update last login
    await this.repo.updateUser(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        roles,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    // Verify token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Refresh token không hợp lệ');
    }

    // Hash token để kiểm tra reuse
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    // Find session - nếu token đã được dùng trước (revoked), từ chối
    const session = await this.repo.findSessionByRefreshToken(tokenHash);
    if (!session || session.revokedAt) {
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Phiên đăng nhập không hợp lệ');
    }

    // Phát hiện reuse token: nếu token này đã được revoke và tạo mới,
    // hoặc nếu session đang hoạt động nhưng token này đã cũ
    // Check: so sánh với session cũ đã bị revoke (nếu có)
    if (session.revokedAt && new Date(session.revokedAt) > new Date()) {
      // Token này đang trong quá trình được revoke
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Phiên đăng nhập đã bị thu hồi');
    }

    if (new Date(session.expiresAt) < new Date()) {
      await this.repo.revokeSession(session.id);
      throw new AppError(ErrorCodes.TOKEN_EXPIRED, 'Refresh token đã hết hạn');
    }

    // Get user info
    const user = await this.repo.findUserById(session.userId);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không tồn tại');
    }
    
    // Get updated roles
    const roles = await this.repo.getUserRoles(session.userId);

    // Rotate tokens
    const newAccessToken = signAccessToken({
      userId: session.userId,
      email: user.email,
      roles,
    });

    const newRefreshToken = signRefreshToken({
      userId: session.userId,
    });

    // Revoke old session, create new one
    await this.repo.revokeSession(session.id);
    
    const newTokenHash = createHash('sha256').update(newRefreshToken).digest('hex');
    await this.repo.createSession({
      userId: session.userId,
      refreshTokenHash: newTokenHash,
      deviceType: session.deviceType ?? undefined,
      deviceName: session.deviceName ?? undefined,
      ipAddress: session.ipAddress ?? undefined,
      userAgent: session.userAgent ?? undefined,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.repo.findSessionByRefreshToken(tokenHash);
    
    if (session) {
      await this.repo.revokeSession(session.id);
    }
  }

  async logoutAll(userId: string) {
    await this.repo.revokeAllUserSessions(userId);
  }

  // Private helpers
  private async handleFailedLogin(userId: string, currentAttempts: number) {
    const newAttempts = currentAttempts + 1;
    const maxAttempts = 5;
    
    if (newAttempts >= maxAttempts) {
      await this.repo.updateUser(userId, {
        failedLoginAttempts: newAttempts,
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });
    } else {
      await this.repo.updateUser(userId, { failedLoginAttempts: newAttempts });
    }
  }

  private async resetFailedAttempts(userId: string) {
    await this.repo.updateUser(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }
}