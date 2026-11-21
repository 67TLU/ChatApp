import { db } from '@/infrastructure/database/connection';
import { friendships, blocks, users, userProfiles } from '@/infrastructure/database/schema';
import { eq, and, or, sql, desc } from 'drizzle-orm';

export class FriendshipRepository {
  // ===== FRIENDSHIPS =====
  
  async findFriendship(requesterId: string, addresseeId: string) {
    return db.query.friendships.findFirst({
      where: and(
        eq(friendships.requesterId, requesterId),
        eq(friendships.addresseeId, addresseeId)
      ),
    });
  }

  async findFriendshipBetween(userId1: string, userId2: string) {
    // Tìm quan hệ giữa 2 người (bất kể chiều)
    return db.query.friendships.findFirst({
      where: or(
        and(
          eq(friendships.requesterId, userId1),
          eq(friendships.addresseeId, userId2)
        ),
        and(
          eq(friendships.requesterId, userId2),
          eq(friendships.addresseeId, userId1)
        )
      ),
    });
  }

  async createFriendRequest(data: {
    requesterId: string;
    addresseeId: string;
    message?: string;
  }) {
    const [friendship] = await db.insert(friendships).values({
      requesterId: data.requesterId,
      addresseeId: data.addresseeId,
      message: data.message,
      status: 'PENDING',
    }).returning();
    return friendship;
  }

  async acceptFriendRequest(friendshipId: string) {
    const [updated] = await db.update(friendships)
      .set({
        status: 'ACCEPTED',
        actedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(friendships.id, friendshipId))
      .returning();
    return updated;
  }

  async rejectFriendRequest(friendshipId: string) {
    const [updated] = await db.update(friendships)
      .set({
        status: 'REJECTED',
        actedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(friendships.id, friendshipId))
      .returning();
    return updated;
  }

  async cancelFriendRequest(friendshipId: string) {
    const [updated] = await db.update(friendships)
      .set({
        status: 'CANCELLED',
        actedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(friendships.id, friendshipId))
      .returning();
    return updated;
  }

  async removeFriendship(friendshipId: string) {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }

  async getFriendsList(userId: string, limit = 50, offset = 0) {
    // Lấy danh sách bạn bè (status = ACCEPTED)
    const result = await db
      .select({
        friendshipId: friendships.id,
        friendId: sql<string>`
          CASE 
            WHEN ${friendships.requesterId} = ${userId} THEN ${friendships.addresseeId}
            ELSE ${friendships.requesterId}
          END
        `,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .where(sql`
        (${friendships.requesterId} = ${userId} OR ${friendships.addresseeId} = ${userId})
        AND ${friendships.status} = 'ACCEPTED'
      `)
      .orderBy(friendships.updatedAt)
      .limit(limit)
      .offset(offset);

    // Lấy thông tin profile của bạn bè
    const friendIds = result.map(r => r.friendId);
    if (friendIds.length === 0) return [];

    const profiles = await db
      .select({
        userId: users.id,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        presenceStatus: userProfiles.presenceStatus,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(sql`${users.id} IN ${friendIds}`);

    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    return result.map(r => ({
      friendshipId: r.friendshipId,
      createdAt: r.createdAt,
      friend: profileMap.get(r.friendId),
    }));
  }

  async getReceivedRequests(userId: string) {
    return db
      .select({
        friendshipId: friendships.id,
        requesterId: friendships.requesterId,
        message: friendships.message,
        createdAt: friendships.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(friendships)
      .leftJoin(users, eq(friendships.requesterId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(sql`
        ${friendships.addresseeId} = ${userId}
        AND ${friendships.status} = 'PENDING'
      `)
      .orderBy(desc(friendships.createdAt));
  }

  async getSentRequests(userId: string) {
    return db
      .select({
        friendshipId: friendships.id,
        addresseeId: friendships.addresseeId,
        message: friendships.message,
        createdAt: friendships.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(friendships)
      .leftJoin(users, eq(friendships.addresseeId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(sql`
        ${friendships.requesterId} = ${userId}
        AND ${friendships.status} = 'PENDING'
      `)
      .orderBy(desc(friendships.createdAt));
  }

  async countReceivedRequests(userId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendships)
      .where(sql`
        ${friendships.addresseeId} = ${userId}
        AND ${friendships.status} = 'PENDING'
      `);
    return result?.count ?? 0;
  }

  // ===== BLOCKS =====

  async findBlock(blockerId: string, blockedId: string) {
    return db.query.blocks.findFirst({
      where: and(
        eq(blocks.blockerId, blockerId),
        eq(blocks.blockedId, blockedId)
      ),
    });
  }

  async isBlocked(blockerId: string, blockedId: string) {
    const block = await this.findBlock(blockerId, blockedId);
    return !!block;
  }

  async isBlockedEitherWay(userId1: string, userId2: string) {
    // Kiểm tra 1 trong 2 người có chặn người kia không
    const block1 = await this.findBlock(userId1, userId2);
    if (block1) return true;
    
    const block2 = await this.findBlock(userId2, userId1);
    return !!block2;
  }

  async createBlock(blockerId: string, blockedId: string, reason?: string) {
    const [block] = await db.insert(blocks).values({
      blockerId,
      blockedId,
      reason,
    }).returning();
    return block;
  }

  async removeBlock(blockerId: string, blockedId: string) {
    await db.delete(blocks).where(
      and(
        eq(blocks.blockerId, blockerId),
        eq(blocks.blockedId, blockedId)
      )
    );
  }

  async getBlockedList(userId: string) {
    return db
      .select({
        blockedId: blocks.blockedId,
        reason: blocks.reason,
        blockedAt: blocks.blockedAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(blocks)
      .leftJoin(users, eq(blocks.blockedId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(blocks.blockerId, userId))
      .orderBy(desc(blocks.blockedAt));
  }
}