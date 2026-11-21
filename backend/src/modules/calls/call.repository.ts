import { db } from '@/infrastructure/database/connection';
import { 
  callSessions, 
  callParticipants, 
  callEvents,
  users,
  userProfiles,
} from '@/infrastructure/database/schema';
import { CallMediaRepository } from './call.media.repository';
import { eq, and, desc, sql } from 'drizzle-orm';import { assertTransition } from './call.state-machine';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
export class CallRepository {
  // ===== CALL SESSIONS =====
  
  async findById(callId: string) {
    return db.query.callSessions.findFirst({
      where: eq(callSessions.id, callId),
    });
  }
async heartbeat(callId: string, userId: string) {
  await new CallMediaRepository().heartbeat(callId, userId);
}
  async createCall(data: {
    callType: 'VOICE' | 'VIDEO';
    scope: 'DIRECT' | 'GROUP';
    conversationId: string;
    initiatorId: string;
  }) {
    const [call] = await db.insert(callSessions).values({
      ...data,
      status: 'CREATED',
    }).returning();
    return call;
  }
// call.repository.ts
async setLogMessageId(callId: string, messageId: string) {
  await db.update(callSessions)
    .set({ logMessageId: messageId })
    .where(eq(callSessions.id, callId));
}
async updateCallStatus(callId: string, data: {
  status: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  endedBy?: string;
  endReason?: string;
  closedAt?: Date;
  logMessageId?: string;
}) {
  const current = await this.findById(callId);
  if (!current) throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');

  assertTransition(current.status, data.status);

  const [updated] = await db.update(callSessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(callSessions.id, callId))
    .returning();
  return updated;
}

  async findActiveCallForUser(userId: string) {
    // Tìm cuộc gọi đang active mà user đang tham gia
    const result = await db.execute<{ id: string }>(sql`
      SELECT cs.* FROM call_sessions cs
      JOIN call_participants cp ON cs.id = cp.call_id
      WHERE cp.user_id = ${userId}
        AND cs.status IN ('CREATED', 'RINGING', 'ACCEPTED', 'CONNECTED', 'RECONNECTING')
      ORDER BY cs.created_at DESC
      LIMIT 1
    `);
    return result[0] || null;
  }

  async findActiveCallInConversation(conversationId: string) {
    const result = await db.execute<{ id: string }>(sql`
      SELECT * FROM call_sessions
      WHERE conversation_id = ${conversationId}
        AND status IN ('CREATED', 'RINGING', 'ACCEPTED', 'CONNECTED', 'RECONNECTING')
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return result[0] || null;
  }

  async getCallHistory(userId: string, limit = 50, offset = 0) {
    return db
      .select({
        id: callSessions.id,
        callType: callSessions.callType,
        scope: callSessions.scope,
        status: callSessions.status,
        conversationId: callSessions.conversationId,
        initiatorId: callSessions.initiatorId,
        startedAt: callSessions.startedAt,
        endedAt: callSessions.endedAt,
        createdAt: callSessions.createdAt,
        initiatorUsername: users.username,
        initiatorDisplayName: userProfiles.displayName,
        initiatorAvatarUrl: userProfiles.avatarUrl,
      })
      .from(callSessions)
      .leftJoin(users, eq(callSessions.initiatorId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(sql`
        EXISTS (
          SELECT 1 FROM call_participants 
          WHERE call_id = ${callSessions.id} 
            AND user_id = ${userId}
        )
      `)
      .orderBy(desc(callSessions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // ===== PARTICIPANTS =====

  async addParticipant(data: {
    callId: string;
    userId: string;
    isHost?: boolean;
  }) {
    const [participant] = await db.insert(callParticipants).values({
      callId: data.callId,
      userId: data.userId,
      status: 'INVITED',
      isHost: data.isHost || false,
    }).returning();
    return participant;
  }

  async getParticipant(callId: string, userId: string) {
    return db.query.callParticipants.findFirst({
      where: and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ),
    });
  }

  async getParticipants(callId: string) {
    return db
      .select({
        userId: callParticipants.userId,
        status: callParticipants.status,
        isMuted: callParticipants.isMuted,
        isVideoOn: callParticipants.isVideoOn,
        isScreenSharing: callParticipants.isScreenSharing,
        joinedAt: callParticipants.joinedAt,
        leftAt: callParticipants.leftAt,
        isHost: callParticipants.isHost,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(callParticipants)
      .leftJoin(users, eq(callParticipants.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(eq(callParticipants.callId, callId));
  }

  async updateParticipantStatus(callId: string, userId: string, status: string) {
    const data: any = { status };
    
    if (status === 'CONNECTED' || status === 'JOINING') {
      data.joinedAt = new Date();
    } else if (status === 'LEFT' || status === 'DISCONNECTED') {
      data.leftAt = new Date();
    }

    const [updated] = await db.update(callParticipants)
      .set(data)
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ))
      .returning();
    return updated;
  }

  async updateParticipantMedia(callId: string, userId: string, data: {
    isMuted?: boolean;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
  }) {
    const [updated] = await db.update(callParticipants)
      .set(data)
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ))
      .returning();
    return updated;
  }

  async countActiveParticipants(callId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callParticipants)
      .where(and(
        eq(callParticipants.callId, callId),
        sql`${callParticipants.status} IN ('CONNECTED', 'JOINING')`
      ));
    return result?.count ?? 0;
  }

  // ===== EVENTS =====

  async logEvent(data: {
    callId: string;
    userId?: string;
    eventType: string;
    metadata?: any;
  }) {
    const [event] = await db.insert(callEvents).values(data).returning();
    return event;
  }

  async getEvents(callId: string) {
    return db.query.callEvents.findMany({
      where: eq(callEvents.callId, callId),
      orderBy: [callEvents.createdAt],
    });
  }
}