import { db } from '@/infrastructure/database/connection';
import { 
  conversations, 
  conversationMembers, 
  conversationReadStates,
  users,
  userProfiles,
  messages,
} from '@/infrastructure/database/schema';
import { eq, and, or, sql, desc, isNull } from 'drizzle-orm';

export class ConversationRepository {
  async findById(conversationId: string) {
    return db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
  }

  async findDirectConversation(user1Id: string, user2Id: string) {
    // Tìm conversation DIRECT giữa 2 người
    const result = await db.execute<{ conversation_id: string }>(sql`
      SELECT c1.conversation_id
      FROM conversation_members c1
      JOIN conversation_members c2
        ON c1.conversation_id = c2.conversation_id
      JOIN conversations conv
        ON c1.conversation_id = conv.id
      WHERE c1.user_id = ${user1Id}
        AND c2.user_id = ${user2Id}
        AND conv.type = 'DIRECT'
        AND conv.deleted_at IS NULL
      LIMIT 1
    `);
    return result[0]?.conversation_id || null;
  }
  async addMember(conversationId: string, userId: string) {
  await db.insert(conversationMembers).values({
    conversationId,
    userId,
    role: 'MEMBER',
    status: 'ACTIVE',
  }).onConflictDoNothing();

  await db.insert(conversationReadStates).values({
    userId,
    conversationId,
  }).onConflictDoNothing();
}

async removeMember(conversationId: string, userId: string) {
  await db.update(conversationMembers)
    .set({ status: 'LEFT', leftAt: new Date() })
    .where(and(
      eq(conversationMembers.conversationId, conversationId),
      eq(conversationMembers.userId, userId)
    ));
}

async updateConversation(conversationId: string, data: Partial<typeof conversations.$inferInsert>) {
  await db.update(conversations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
  async createDirectConversation(user1Id: string, user2Id: string) {
    // Tạo conversation
    const [conv] = await db.insert(conversations).values({
      type: 'DIRECT',
    }).returning();

    // Thêm 2 members
    await db.insert(conversationMembers).values([
      { conversationId: conv.id, userId: user1Id, role: 'MEMBER' },
      { conversationId: conv.id, userId: user2Id, role: 'MEMBER' },
    ]);

    // Tạo read states
    await db.insert(conversationReadStates).values([
      { userId: user1Id, conversationId: conv.id },
      { userId: user2Id, conversationId: conv.id },
    ]);

    return conv;
  }

  async createGroupConversation(data: {
    name: string;
    ownerId: string;
    memberIds: string[];
    description?: string;
  }) {
    const [conv] = await db.insert(conversations).values({
      type: 'GROUP',
      name: data.name,
      description: data.description,
      ownerId: data.ownerId,
    }).returning();

    // Thêm members (owner + các member khác)
    const memberValues = [
      { conversationId: conv.id, userId: data.ownerId, role: 'OWNER' as const },
      ...data.memberIds.filter(id => id !== data.ownerId).map(id => ({
        conversationId: conv.id,
        userId: id,
        role: 'MEMBER' as const,
      })),
    ];

    await db.insert(conversationMembers).values(memberValues);

    // Tạo read states
    const readStateValues = [data.ownerId, ...data.memberIds].map(userId => ({
      userId,
      conversationId: conv.id,
    }));
    await db.insert(conversationReadStates).values(readStateValues);

    return conv;
  }

  async getUserConversations(userId: string, limit = 50, offset = 0) {
    // Lấy danh sách conversations của user, sort theo lastMessageAt
    const result = await db
      .select({
        id: conversations.id,
        type: conversations.type,
        name: conversations.name,
        avatarUrl: conversations.avatarUrl,
        ownerId: conversations.ownerId,
        lastMessageId: conversations.lastMessageId,
        lastMessageAt: conversations.lastMessageAt,
        lastMessagePreview: conversations.lastMessagePreview,
        lastMessageSenderId: conversations.lastMessageSenderId,
        unreadCount: conversationReadStates.unreadCount,
      })
      .from(conversations)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversations.id, conversationMembers.conversationId),
          eq(conversationMembers.userId, userId),
          eq(conversationMembers.status, 'ACTIVE')
        )
      )
      .leftJoin(
        conversationReadStates,
        and(
          eq(conversations.id, conversationReadStates.conversationId),
          eq(conversationReadStates.userId, userId)
        )
      )
      .where(isNull(conversations.deletedAt))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    // Với DIRECT conversations, lấy thông tin người còn lại
    const directConvs = result.filter(c => c.type === 'DIRECT');
    const otherUserMap = new Map<string, any>();

    if (directConvs.length > 0) {
      const convIds = directConvs.map(c => c.id);
      
      // Query lấy other user của mỗi DIRECT conversation
      for (const convId of convIds) {
        const [otherMember] = await db.execute<{ user_id: string }>(sql`
          SELECT user_id FROM conversation_members
          WHERE conversation_id = ${convId} AND user_id != ${userId}
          LIMIT 1
        `);
        
        if (otherMember) {
          const [profile] = await db
            .select({
              userId: users.id,
              username: users.username,
              displayName: userProfiles.displayName,
              avatarUrl: userProfiles.avatarUrl,
            })
            .from(users)
            .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
            .where(eq(users.id, otherMember.user_id));
          
          otherUserMap.set(convId, profile);
        }
      }
    }

    return result.map(conv => ({
      ...conv,
      otherUser: conv.type === 'DIRECT' ? otherUserMap.get(conv.id) : null,
    }));
  }

  async isMember(conversationId: string, userId: string) {
    const member = await db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId),
        eq(conversationMembers.status, 'ACTIVE')
      ),
    });
    return !!member;
  }

  async getMember(conversationId: string, userId: string) {
    return db.query.conversationMembers.findFirst({
      where: and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.userId, userId)
      ),
    });
  }

  async getMembers(conversationId: string) {
    return db
      .select({
        userId: conversationMembers.userId,
        role: conversationMembers.role,
        status: conversationMembers.status,
        nickname: conversationMembers.nickname,
        joinedAt: conversationMembers.joinedAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(conversationMembers)
      .leftJoin(users, eq(conversationMembers.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(
        eq(conversationMembers.conversationId, conversationId),
        eq(conversationMembers.status, 'ACTIVE')
      ));
  }

  async updateLastMessage(conversationId: string, data: {
    messageId: string;
    senderId: string;
    preview: string;
  }) {
    await db.update(conversations)
      .set({
        lastMessageId: data.messageId,
        lastMessageAt: new Date(),
        lastMessagePreview: data.preview,
        lastMessageSenderId: data.senderId,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));
  }

  async getReadState(userId: string, conversationId: string) {
    return db.query.conversationReadStates.findFirst({
      where: and(
        eq(conversationReadStates.userId, userId),
        eq(conversationReadStates.conversationId, conversationId)
      ),
    });
  }

  async updateReadState(userId: string, conversationId: string, data: {
    lastReadMessageId: string;
    lastReadAt: Date;
  }) {
    await db.update(conversationReadStates)
      .set({
        lastReadMessageId: data.lastReadMessageId,
        lastReadAt: data.lastReadAt,
        unreadCount: 0,
        mentionedCount: 0,
        updatedAt: new Date(),
      })
      .where(and(
        eq(conversationReadStates.userId, userId),
        eq(conversationReadStates.conversationId, conversationId)
      ));
  }

  async incrementUnreadCount(conversationId: string, excludeUserId: string) {
    // Tăng unread count cho tất cả members (trừ sender)
    await db.execute(sql`
      UPDATE conversation_read_states
      SET unread_count = unread_count + 1,
          updated_at = NOW()
      WHERE conversation_id = ${conversationId}
        AND user_id != ${excludeUserId}
    `);
  }
}