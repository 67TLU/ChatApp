import { Server, Socket } from 'socket.io';
import { db } from '@/infrastructure/database/connection';
import { userProfiles, userSettings } from '@/infrastructure/database/schema';
import { eq, inArray, sql } from 'drizzle-orm';

// Lưu connection map: userId → Set<socketId>
const userConnections = new Map<string, Set<string>>();

export class PresenceManager {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  // User kết nối
  async handleConnect(socket: Socket) {
    const userId = socket.data.userId;
    
    // Thêm connection vào map
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(socket.id);

    // Lưu socketId vào socket.data để dùng khi disconnect
    socket.data.presenceUserId = userId;

    // Nếu đây là connection đầu tiên → cập nhật status
    if (userConnections.get(userId)!.size === 1) {
      await this.setUserOnline(userId);
    }

    // Thông báo cho bạn bè
    await this.broadcastPresence(userId);
  }

  // User ngắt kết nối
  async handleDisconnect(socket: Socket) {
    const userId = socket.data.presenceUserId;
    if (!userId) return;

    const connections = userConnections.get(userId);
    if (!connections) return;

    connections.delete(socket.id);

    // Nếu không còn connection nào → offline
    if (connections.size === 0) {
      userConnections.delete(userId);
      await this.setUserOffline(userId);
      await this.broadcastPresence(userId);
    }
  }

  // Cập nhật trạng thái (user tự chọn)
  async updatePresenceStatus(userId: string, status: string, customStatus?: string) {
    const validStatuses = ['ONLINE', 'AWAY', 'BUSY', 'DND'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid presence status');
    }

    // Cập nhật settings (trạng thái mặc định)
    await db.update(userSettings)
      .set({
        defaultPresence: status,
        customStatus: customStatus || null,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId));

    // Nếu đang online → cập nhật profile
    if (this.isUserOnline(userId)) {
      await db.update(userProfiles)
        .set({
          presenceStatus: status,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId));
    }

    // Broadcast
    await this.broadcastPresence(userId);
  }

  // Kiểm tra user có online không
  isUserOnline(userId: string): boolean {
    const connections = userConnections.get(userId);
    return !!connections && connections.size > 0;
  }

  // Lấy số connection của user
  getConnectionCount(userId: string): number {
    return userConnections.get(userId)?.size ?? 0;
  }

  // Lấy trạng thái của nhiều users
  async getPresenceStatus(userIds: string[]) {
    const result: Record<string, {
      isOnline: boolean;
      status: string;
      customStatus?: string;
      connectionCount: number;
    }> = {};

    // Lấy từ DB
    const profiles = await db
      .select({
        userId: userProfiles.userId,
        presenceStatus: userProfiles.presenceStatus,
        customStatus: userProfiles.customStatus,
      })
      .from(userProfiles)
      .where(inArray(userProfiles.userId, userIds));

    for (const userId of userIds) {
      const isOnline = this.isUserOnline(userId);
      const profile = profiles.find(p => p.userId === userId);
      
      result[userId] = {
        isOnline,
        status: isOnline ? (profile?.presenceStatus || 'ONLINE') : 'OFFLINE',
        customStatus: profile?.customStatus || undefined,
        connectionCount: this.getConnectionCount(userId),
      };
    }

    return result;
  }

  // Private: Set user online
  private async setUserOnline(userId: string) {
    // Lấy default presence từ settings
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.userId, userId),
    });

    const status = settings?.defaultPresence || 'ONLINE';

    await db.update(userProfiles)
      .set({
        presenceStatus: status,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));
  }

  // Private: Set user offline
  private async setUserOffline(userId: string) {
    await db.update(userProfiles)
      .set({
        presenceStatus: 'OFFLINE',
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));
  }

  // Private: Broadcast presence cho bạn bè
  private async broadcastPresence(userId: string) {
    const isOnline = this.isUserOnline(userId);
    
    // Lấy profile
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    });

    // Lấy danh sách bạn bè
    const friends = await db.execute<{ friend_id: string }>(sql`
      SELECT 
        CASE 
          WHEN requester_id = ${userId} THEN addressee_id
          ELSE requester_id
        END as friend_id
      FROM friendships
      WHERE (requester_id = ${userId} OR addressee_id = ${userId})
        AND status = 'ACCEPTED'
    `);

    // Emit cho từng bạn bè
    for (const row of friends) {
      const friendId = row.friend_id;
      
      // Emit đến tất cả sockets của bạn bè
      this.io.to(`user:${friendId}`).emit('presence:changed', {
        userId,
        isOnline,
        status: profile?.presenceStatus || (isOnline ? 'ONLINE' : 'OFFLINE'),
        customStatus: profile?.customStatus,
        connectionCount: this.getConnectionCount(userId),
      });
    }
  }
}

// Export singleton để dùng ở nơi khác
export const presenceManager = {
  userConnections,
};