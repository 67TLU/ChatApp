import { db } from '@/infrastructure/database/connection';
import {
  callScreenShares, callQualityStats, callParticipants,
  callSessions, userMediaSettings,
} from '@/infrastructure/database/schema';
import { eq, and, desc, sql, lt, inArray } from 'drizzle-orm';

export class CallMediaRepository {
  // ===== SCREEN SHARE =====

  async countActiveShares(callId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callScreenShares)
      .where(and(
        eq(callScreenShares.callId, callId),
        eq(callScreenShares.status, 'ACTIVE')
      ));
    return row?.count ?? 0;
  }

  async findActiveShareByUser(callId: string, userId: string) {
    return db.query.callScreenShares.findFirst({
      where: and(
        eq(callScreenShares.callId, callId),
        eq(callScreenShares.userId, userId),
        eq(callScreenShares.status, 'ACTIVE')
      ),
    });
  }

  async getActiveShares(callId: string) {
    return db.query.callScreenShares.findMany({
      where: and(
        eq(callScreenShares.callId, callId),
        eq(callScreenShares.status, 'ACTIVE')
      ),
      orderBy: [desc(callScreenShares.startedAt)],
    });
  }

  async startShare(data: {
    callId: string;
    userId: string;
    sourceType: 'SCREEN' | 'WINDOW' | 'TAB';
    withAudio: boolean;
  }) {
    const [share] = await db.insert(callScreenShares).values(data).returning();
    return share;
  }

  async stopShare(shareId: string, reason = 'USER_STOPPED') {
    const [share] = await db.update(callScreenShares)
      .set({ status: 'STOPPED', stoppedAt: new Date(), stopReason: reason })
      .where(eq(callScreenShares.id, shareId))
      .returning();
    return share;
  }

  async stopAllSharesOfUser(callId: string, userId: string, reason = 'USER_LEFT') {
    await db.update(callScreenShares)
      .set({ status: 'STOPPED', stoppedAt: new Date(), stopReason: reason })
      .where(and(
        eq(callScreenShares.callId, callId),
        eq(callScreenShares.userId, userId),
        eq(callScreenShares.status, 'ACTIVE')
      ));
  }

  async stopAllSharesOfCall(callId: string, reason = 'CALL_ENDED') {
    await db.update(callScreenShares)
      .set({ status: 'STOPPED', stoppedAt: new Date(), stopReason: reason })
      .where(and(
        eq(callScreenShares.callId, callId),
        eq(callScreenShares.status, 'ACTIVE')
      ));
  }

  // ===== QUALITY =====

  async saveQuality(data: {
    callId: string;
    userId: string;
    rttMs?: number;
    packetLoss?: number;
    jitterMs?: number;
    bitrateKbps?: number;
    frameWidth?: number;
    frameHeight?: number;
    framesPerSecond?: number;
    quality: string;
  }) {
    const [row] = await db.insert(callQualityStats).values(data).returning();
    return row;
  }

  async updateParticipantQuality(callId: string, userId: string, quality: string) {
    await db.update(callParticipants)
      .set({ connectionQuality: quality })
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ));
  }

  async getQualitySummary(callId: string) {
    return db.execute<{
      user_id: string;
      avg_rtt: number | null;
      avg_loss: number | null;
      samples: number;
    }>(sql`
      SELECT user_id,
             AVG(rtt_ms)::float AS avg_rtt,
             AVG(packet_loss)::float AS avg_loss,
             COUNT(*)::int AS samples
      FROM call_quality_stats
      WHERE call_id = ${callId}
      GROUP BY user_id
    `);
  }

  // ===== RECONNECT =====

  async markDisconnected(callId: string, userId: string) {
    const [p] = await db.update(callParticipants)
      .set({ status: 'DISCONNECTED', lastDisconnectAt: new Date() })
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ))
      .returning();
    return p;
  }

  async markReconnected(callId: string, userId: string) {
    const [p] = await db.update(callParticipants)
      .set({
        status: 'CONNECTED',
        lastSeenAt: new Date(),
        reconnectCount: sql`${callParticipants.reconnectCount} + 1`,
      })
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ))
      .returning();
    return p;
  }

  async heartbeat(callId: string, userId: string) {
    await db.update(callParticipants)
      .set({ lastSeenAt: new Date() })
      .where(and(
        eq(callParticipants.callId, callId),
        eq(callParticipants.userId, userId)
      ));
  }

  async findActiveCallsOfUser(userId: string) {
    return db.execute<{
      call_id: string;
      status: string;
      call_type: string;
      conversation_id: string;
      participant_status: string;
    }>(sql`
      SELECT cs.id AS call_id, cs.status, cs.call_type,
             cs.conversation_id, cp.status AS participant_status
      FROM call_sessions cs
      JOIN call_participants cp ON cp.call_id = cs.id
      WHERE cp.user_id = ${userId}
        AND cs.status IN ('CREATED','RINGING','ACCEPTED','CONNECTED','RECONNECTING')
        AND cp.status IN ('INVITED','JOINING','CONNECTED','DISCONNECTED')
      ORDER BY cs.created_at DESC
    `);
  }

  async findStaleCalls(maxAgeMs: number) {
    const cutoff = new Date(Date.now() - maxAgeMs);
    return db.query.callSessions.findMany({
      where: and(
        inArray(callSessions.status, ['CREATED', 'RINGING', 'ACCEPTED', 'CONNECTED', 'RECONNECTING']),
        lt(callSessions.createdAt, cutoff)
      ),
    });
  }

  // ===== MEDIA SETTINGS =====

  async getMediaSettings(userId: string) {
    return db.query.userMediaSettings.findFirst({
      where: eq(userMediaSettings.userId, userId),
    });
  }

  async upsertMediaSettings(userId: string, data: Partial<typeof userMediaSettings.$inferInsert>) {
    const [row] = await db.insert(userMediaSettings)
      .values({ userId, ...data })
      .onConflictDoUpdate({
        target: userMediaSettings.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return row;
  }
}