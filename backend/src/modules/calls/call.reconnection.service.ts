import { CallRepository } from './call.repository';
import { CallMediaRepository } from './call.media.repository';
import { ScreenShareService } from './screen-share.service';
import { CallFinalizeService } from './call.finalize.service';
import { callLifecycle } from './call.lifecycle';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { CALL_CONFIG } from '@/config/call.config';
import { isTerminal } from './call.state-machine';

export class CallReconnectionService {
  private callRepo = new CallRepository();
  private mediaRepo = new CallMediaRepository();
  private screenShare = new ScreenShareService();
  private finalize = new CallFinalizeService();

  /**
   * Gọi khi socket của user断开.
   * Không kết thúc cuộc gọi ngay — cho grace period.
   */
  async handleDisconnect(userId: string) {
    const activeCalls = await this.mediaRepo.findActiveCallsOfUser(userId);

    for (const row of activeCalls) {
      const callId = row.call_id;

      // Cuộc gọi chưa nhấc máy → bỏ qua, để ringing timeout xử lý
      if (['CREATED', 'RINGING'].includes(row.status)) continue;
      if (!['CONNECTED', 'JOINING'].includes(row.participant_status)) continue;

      await this.mediaRepo.markDisconnected(callId, userId);

      // Dừng screen share ngay (track đã chết)
      const stopped = await this.screenShare.forceStopForUser(callId, userId, 'DISCONNECTED');

      const call = await this.callRepo.findById(callId);
      if (!call || isTerminal(call.status)) continue;

      // Chuyển call sang RECONNECTING nếu đang CONNECTED
      if (call.status === 'CONNECTED') {
        await this.callRepo.updateCallStatus(callId, { status: 'RECONNECTING' }).catch(() => null);
      }

      await this.callRepo.logEvent({
        callId, userId, eventType: 'PARTICIPANT_DISCONNECTED',
      });

      const io = callLifecycle.getIO();
      const participants = await this.callRepo.getParticipants(callId);

      for (const p of participants) {
        if (p.userId === userId) continue;
        io.to(`user:${p.userId}`).emit('call:participant-disconnected', {
          callId,
          userId,
          gracePeriodMs: CALL_CONFIG.RECONNECT_GRACE_MS,
          screenShareStopped: !!stopped,
        });
      }

      // Bắt đầu đếm grace
      callLifecycle.startReconnectGrace(callId, userId, async () => {
        await this.handleGraceExpired(callId, userId);
      });
    }
  }

  /** Grace hết hạn → coi như rời cuộc gọi */
  private async handleGraceExpired(callId: string, userId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call || isTerminal(call.status)) return;

    await this.callRepo.updateParticipantStatus(callId, userId, 'LEFT');
    await this.screenShare.forceStopForUser(callId, userId, 'GRACE_EXPIRED');

    await this.callRepo.logEvent({
      callId, userId, eventType: 'RECONNECT_TIMEOUT',
    });

    const io = callLifecycle.getIO();
    const participants = await this.callRepo.getParticipants(callId);
    const remaining = participants.filter(p =>
      ['CONNECTED', 'JOINING'].includes(p.status) && p.userId !== userId
    );

    for (const p of remaining) {
      io.to(`user:${p.userId}`).emit('call:participant-left', {
        callId, userId, reason: 'RECONNECT_TIMEOUT',
      });
    }

    // P2P:只剩 1 người → kết thúc cuộc gọi
    if (remaining.length === 0) {
      await this.finalize.finalizeCall(callId, {
        status: 'ENDED',
        endedBy: userId,
        endReason: 'RECONNECT_TIMEOUT',
      });
    } else if (call.scope === 'DIRECT') {
      await this.finalize.finalizeCall(callId, {
        status: 'ENDED',
        endedBy: userId,
        endReason: 'PEER_TIMEOUT',
      });
    }
  }

  /**
   * Client reconnect socket và xin quay lại cuộc gọi.
   * Trả về snapshot để client dựng lại RTCPeerConnection.
   */
  async resumeCall(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call || isTerminal(call.status)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi đã kết thúc');
    }

    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant || ['LEFT', 'REJECTED', 'KICKED'].includes(participant.status)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không còn trong cuộc gọi này');
    }

    if (participant.reconnectCount >= CALL_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Vượt quá số lần kết nối lại cho phép');
    }

    callLifecycle.clearReconnectGrace(callId, userId);
    await this.mediaRepo.markReconnected(callId, userId);

    // Nếu tất cả participant còn lại đều CONNECTED → đưa call về CONNECTED
    const participants = await this.callRepo.getParticipants(callId);
    const everyoneConnected = participants
      .filter(p => ['CONNECTED', 'JOINING', 'DISCONNECTED'].includes(p.status))
      .every(p => p.status === 'CONNECTED' || p.userId === userId);

    if (everyoneConnected && call.status === 'RECONNECTING') {
      await this.callRepo.updateCallStatus(callId, { status: 'CONNECTED' }).catch(() => null);
    }

    await this.callRepo.logEvent({
      callId, userId, eventType: 'PARTICIPANT_RECONNECTED',
      metadata: { attempt: participant.reconnectCount + 1 },
    });

    const io = callLifecycle.getIO();
    for (const p of participants) {
      if (p.userId === userId) continue;
      io.to(`user:${p.userId}`).emit('call:participant-reconnected', { callId, userId });
    }

    const activeShares = await this.mediaRepo.getActiveShares(callId);

    return {
      callId,
      callType: call.callType,
      scope: call.scope,
      status: call.status,
      conversationId: call.conversationId,
      initiatorId: call.initiatorId,
      // Client cần biết mình là caller hay callee để tạo offer lại
      shouldCreateOffer: call.initiatorId === userId,
      self: {
        isMuted: participant.isMuted,
        isVideoOn: participant.isVideoOn,
        isScreenSharing: false, // track cũ đã chết
        reconnectCount: participant.reconnectCount + 1,
      },
      participants: participants.filter(p => p.userId !== userId),
      activeScreenShares: activeShares,
      // ICE candidates cũ không dùng lại được → renegotiation full
      renegotiationRequired: true,
    };
  }

  /** Danh sách cuộc gọi đang active của user (dùng khi mở lại app) */
  async getActiveCalls(userId: string) {
    const rows = await this.mediaRepo.findActiveCallsOfUser(userId);
    return rows.map(r => ({
      callId: r.call_id,
      status: r.status,
      callType: r.call_type,
      conversationId: r.conversation_id,
      participantStatus: r.participant_status,
      resumable: ['ACCEPTED', 'CONNECTED', 'RECONNECTING'].includes(r.status),
    }));
  }
}