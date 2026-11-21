import { db } from '@/infrastructure/database/connection';
import { 
  messages, 
  messageAttachments,
  messageReceipts,
  messageReactions,
  messagePins,
  users,
  userProfiles,
} from '@/infrastructure/database/schema';
import { eq, and, lt, desc, sql } from 'drizzle-orm';

export class MessageRepository {
  async findById(messageId: string) {
    return db.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });
  }

  async findByClientId(clientMessageId: string) {
    return db.query.messages.findFirst({
      where: eq(messages.clientMessageId, clientMessageId),
    });
  }

  // ⭐ Cursor pagination - quan trọng nhất
  async getMessages(conversationId: string, options: {
    cursor?: string; // messageId để load older messages
    limit?: number;
  } = {}) {
    // Limit tối đa 100 để tránh quá tải
    const limit = Math.min(options.limit || 50, 100);
    
    let query;
    
    if (options.cursor) {
      // Load messages older than cursor
      const cursorMsg = await this.findById(options.cursor);
      if (!cursorMsg) return [];
      
      const result = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          clientMessageId: messages.clientMessageId,
          content: messages.content,
          messageType: messages.messageType,
          replyToMessageId: messages.replyToMessageId,
          status: messages.status,
          editedAt: messages.editedAt,
          deletedAt: messages.deletedAt,
          createdAt: messages.createdAt,
          senderUsername: users.username,
          senderDisplayName: userProfiles.displayName,
          senderAvatarUrl: userProfiles.avatarUrl,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(and(
          eq(messages.conversationId, conversationId),
          lt(messages.createdAt, cursorMsg.createdAt)
        ))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      
      return result;
    } else {
      // Load newest messages
      const result = await db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          senderId: messages.senderId,
          clientMessageId: messages.clientMessageId,
          content: messages.content,
          messageType: messages.messageType,
          replyToMessageId: messages.replyToMessageId,
          status: messages.status,
          editedAt: messages.editedAt,
          deletedAt: messages.deletedAt,
          createdAt: messages.createdAt,
          senderUsername: users.username,
          senderDisplayName: userProfiles.displayName,
          senderAvatarUrl: userProfiles.avatarUrl,
        })
        .from(messages)
        .leftJoin(users, eq(messages.senderId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      
      return result;
    }
  }

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    clientMessageId?: string;
    content?: string;
    messageType?: string;
    replyToMessageId?: string;
  }) {
    const [message] = await db.insert(messages).values({
      conversationId: data.conversationId,
      senderId: data.senderId,
      clientMessageId: data.clientMessageId,
      content: data.content,
      messageType: data.messageType || 'TEXT',
      replyToMessageId: data.replyToMessageId,
      status: 'SENT',
    }).returning();
    
    return message;
  }

  async editMessage(messageId: string, content: string) {
    const [updated] = await db.update(messages)
      .set({
        content,
        status: 'EDITED',
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  }

  async softDeleteMessage(messageId: string, userId: string, deleteFor: 'ME' | 'EVERYONE' = 'ME') {
    const message = await this.findById(messageId);
    if (!message) return null;

    // Xử lý theo phạm vi deleteFor
    if (deleteFor === 'EVERYONE' || message.senderId === userId) {
      // Nếu là admin hoặc deleteFor là EVERYONE: xóa content, set senderId = NULL
      const setData: any = {
        status: 'DELETED',
        content: deleteFor === 'EVERYONE' ? null : message.content,
        deletedAt: new Date(),
        deletedBy: userId,
        updatedAt: new Date(),
      };
      if (deleteFor === 'EVERYONE') {
        setData.senderId = null;
      }
      const [updated] = await db.update(messages).set(setData).where(eq(messages.id, messageId)).returning();
      return updated;
    } else {
      // deleteFor === 'ME': chỉ mark deleted_at = NOW (content vẫn giữ)
      const [updated] = await db.update(messages)
        .set({
          status: 'DELETED',
          deletedAt: new Date(),
          deletedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId))
        .returning();
      return updated;
    }
  }

  // Attachments
  async addAttachment(data: {
    messageId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    mimeType?: string;
    storagePath: string;
    url: string;
    width?: number;
    height?: number;
  }) {
    const [attachment] = await db.insert(messageAttachments).values(data).returning();
    return attachment;
  }

  async getAttachments(messageId: string) {
    return db.query.messageAttachments.findMany({
      where: eq(messageAttachments.messageId, messageId),
    });
  }

  // Receipts
  async markDelivered(messageId: string, userId: string) {
    await db.insert(messageReceipts).values({
      messageId,
      userId,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    }).onConflictDoUpdate({
      target: [messageReceipts.messageId, messageReceipts.userId],
      set: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });
  }

  async markRead(messageId: string, userId: string) {
    await db.insert(messageReceipts).values({
      messageId,
      userId,
      status: 'READ',
      deliveredAt: new Date(),
      readAt: new Date(),
    }).onConflictDoUpdate({
      target: [messageReceipts.messageId, messageReceipts.userId],
      set: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  async getLatestMessageId(conversationId: string) {
    const [row] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    return row?.id ?? null;
  }

  async markConversationRead(conversationId: string, userId: string) {
    // Mark tất cả messages trong conversation là READ cho user
    await db.execute<any>(sql`
      INSERT INTO message_receipts (message_id, user_id, status, delivered_at, read_at)
      SELECT id, ${userId}, 'READ', NOW(), NOW()
      FROM messages
      WHERE conversation_id = ${conversationId}
        AND sender_id != ${userId}
      ON CONFLICT (message_id, user_id) 
      DO UPDATE SET status = 'READ', read_at = NOW()
    `);
  }

  // Reactions
  async addReaction(messageId: string, userId: string, emoji: string) {
    // Kiểm tra reaction đã tồn tại chưa (tránh duplicate)
    const existing = await db.query.messageReactions.findFirst({
      where: and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      ),
    });
    if (existing) {
      return existing;
    }
    const [reaction] = await db.insert(messageReactions).values({
      messageId,
      userId,
      emoji,
    }).returning();
    return reaction;
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    await db.delete(messageReactions).where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji)
      )
    );
  }

  async getReactions(messageIds: string[]) {
    if (messageIds.length === 0) return [];
    
    return db
      .select({
        messageId: messageReactions.messageId,
        emoji: messageReactions.emoji,
        userId: messageReactions.userId,
        username: users.username,
        displayName: userProfiles.displayName,
      })
      .from(messageReactions)
      .leftJoin(users, eq(messageReactions.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(sql`${messageReactions.messageId} IN ${messageIds}`);
  }

// Batch get attachments by message IDs - tránh N+1 query
async getAttachmentsBatch(messageIds: string[]) {
  if (messageIds.length === 0) return [];
  return db.query.messageAttachments.findMany({
    where: sql`${messageAttachments.messageId} IN ${messageIds}`,
    orderBy: (messageAttachments) => [messageAttachments.createdAt],
  });
}

// Pins
  // Pins
  async pinMessage(messageId: string, conversationId: string, pinnedBy: string) {
    const [pin] = await db.insert(messagePins).values({
      messageId,
      conversationId,
      pinnedBy,
    }).returning();
    return pin;
  }

  async unpinMessage(messageId: string) {
    await db.delete(messagePins).where(eq(messagePins.messageId, messageId));
  }

  async getPins(conversationId: string) {
    return db
      .select({
        id: messagePins.id,
        messageId: messagePins.messageId,
        pinnedBy: messagePins.pinnedBy,
        pinnedAt: messagePins.pinnedAt,
        content: messages.content,
        senderId: messages.senderId,
        senderUsername: users.username,
        senderDisplayName: userProfiles.displayName,
      })
      .from(messagePins)
      .leftJoin(messages, eq(messagePins.messageId, messages.id))
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messagePins.conversationId, conversationId))
      .orderBy(desc(messagePins.pinnedAt));
  }
}