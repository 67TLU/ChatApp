import { db } from '@/infrastructure/database/connection';
import { users, userProfiles, userSettings, friendships, blocks } from '@/infrastructure/database/schema';
import { eq, and, or, sql, ilike, ne } from 'drizzle-orm';

export class UserRepository {
  async findById(userId: string) {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        status: users.status,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        coverUrl: userProfiles.coverUrl,
        bio: userProfiles.bio,
        customStatus: userProfiles.customStatus,
        presenceStatus: userProfiles.presenceStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(users.id, userId));

    return row || null;
  }

  async updateProfile(userId: string, data: {
    displayName?: string;
    bio?: string;
    customStatus?: string;
  }) {
    const [updated] = await db.update(userProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId))
      .returning();
    return updated;
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await db.update(userProfiles)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  async updateCover(userId: string, coverUrl: string) {
    await db.update(userProfiles)
      .set({ coverUrl, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  async updatePresence(userId: string, status: string) {
    await db.update(userProfiles)
      .set({ presenceStatus: status, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  /** Tìm user theo username, display name, email (chỉ những người cho phép tìm) */
  async searchUsers(query: string, currentUserId: string, limit = 20) {
    const q = `%${query}%`;

    // Loại những người đã block mình hoặc mình block
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        presenceStatus: userProfiles.presenceStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(
        ne(users.id, currentUserId),
        eq(users.status, 'ACTIVE'),
        or(
          ilike(users.username, q),
          ilike(userProfiles.displayName, q)
        ),
        // Không trả về người đã block nhau
        sql`NOT EXISTS (
          SELECT 1 FROM blocks 
          WHERE (blocker_id = ${users.id} AND blocked_id = ${currentUserId})
             OR (blocker_id = ${currentUserId} AND blocked_id = ${users.id})
        )`
      ))
      .limit(limit);

    return result;
  }

  async changePassword(userId: string, newPasswordHash: string) {
    await db.update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getSettings(userId: string) {
    return db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });
  }

  async updateSettings(userId: string, data: Partial<typeof userSettings.$inferInsert>) {
    const [updated] = await db.update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, userId))
      .returning();
    return updated;
  }
}