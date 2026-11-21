import { db } from '@/infrastructure/database/connection';
import { users, userProfiles, userSessions, roles, userRoles } from '@/infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';

export class AuthRepository {
  async findUserByEmail(email: string) {
    // Normalize email: lowercase and trim
    const normalizedEmail = email.toLowerCase().trim();
    return db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
  }
async findUserById(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  });
}
  async findUserByUsername(username: string) {
    return db.query.users.findFirst({
      where: eq(users.username, username),
    });
  }

  async createUser(data: {
    email: string;
    username: string;
    passwordHash: string;
  }) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async createUserProfile(userId: string, displayName?: string) {
    await db.insert(userProfiles).values({
      userId,
      displayName: displayName || userId.slice(0, 8),
    });
  }

  async assignDefaultRole(userId: string) {
    const userRole = await db.query.roles.findFirst({
      where: eq(roles.name, 'USER'),
    });
    if (userRole) {
      await db.insert(userRoles).values({
        userId,
        roleId: userRole.id,
      });
    }
  }

  async createSession(data: {
    userId: string;
    refreshTokenHash: string;
    deviceType?: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    const [session] = await db.insert(userSessions).values(data).returning();
    return session;
  }

  async findSessionByRefreshToken(tokenHash: string) {
    return db.query.userSessions.findFirst({
      where: eq(userSessions.refreshTokenHash, tokenHash),
    });
  }

  async revokeSession(sessionId: string) {
    await db.update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, sessionId));
  }

  async revokeAllUserSessions(userId: string) {
    await db.update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.userId, userId));
  }

  async getUserRoles(userId: string) {
    const result = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    
    return result.map(r => r.name);
  }

  async updateUser(userId: string, data: Partial<typeof users.$inferInsert>) {
    await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}
