import { db } from '@/infrastructure/database/connection';
import { 
  emailVerificationTokens, 
  passwordResetTokens, 
  users,
} from '@/infrastructure/database/schema';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export class AuthVerificationRepository {
  // ===== EMAIL VERIFICATION =====

  async createEmailVerificationToken(userId: string) {
    // Xóa token cũ (nếu có)
    await db.delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + (Number(process.env.VERIFY_TOKEN_EXPIRY_HOURS) || 24) * 60 * 60 * 1000
    );

    const [row] = await db.insert(emailVerificationTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return row;
  }

  async findEmailToken(token: string) {
    return db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        gt(emailVerificationTokens.expiresAt, new Date())
      ),
    });
  }

  async markEmailTokenUsed(tokenId: string) {
    await db.update(emailVerificationTokens)
      .set({ verifiedAt: new Date() })
      .where(eq(emailVerificationTokens.id, tokenId));
  }

  async markUserEmailVerified(userId: string) {
    await db.update(users)
      .set({
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // ===== PASSWORD RESET =====

  async createPasswordResetToken(userId: string) {
    // Xóa token cũ
    await db.delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + (Number(process.env.RESET_TOKEN_EXPIRY_HOURS) || 1) * 60 * 60 * 1000
    );

    const [row] = await db.insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return row;
  }

  async findResetToken(token: string) {
    return db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    });
  }

  async markResetTokenUsed(tokenId: string) {
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    await db.update(users)
      .set({
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}