import { db } from '@/infrastructure/database/connection';
import { 
  notifications,
  users, 
  userProfiles 
} from '@/infrastructure/database/schema';
import { eq, and, desc, sql, lt } from 'drizzle-orm';

export class NotificationRepository {
  async create(data: {
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
    const [row] = await db.insert(notifications).values(data).returning();
    return row;
  }

  // ⭐ Dùng raw select thay vì relational query
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return row || null;
  }

  async getUserNotifications(userId: string, options: {
    unreadOnly?: boolean;
    cursor?: string;
    limit?: number;
  } = {}) {
    const limit = options.limit || 50;
    const conditions = [eq(notifications.userId, userId)];
    
    if (options.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    if (options.cursor) {
      const cursorRow = await this.findById(options.cursor);
      if (cursorRow) {
        conditions.push(lt(notifications.createdAt, cursorRow.createdAt));
      }
    }

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        iconUrl: notifications.iconUrl,
        actionUrl: notifications.actionUrl,
        resourceType: notifications.resourceType,
        resourceId: notifications.resourceId,
        actorId: notifications.actorId,
        isRead: notifications.isRead,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorUsername: users.username,
        actorDisplayName: userProfiles.displayName,
        actorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    return rows;
  }

  async markAsRead(id: string, userId: string) {
    const [updated] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();
    return updated;
  }

  async markAllAsRead(userId: string) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(id: string, userId: string) {
    await db.delete(notifications).where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      )
    );
  }

  async countUnread(userId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return row?.count ?? 0;
  }
}
