import { CallRepository } from './call.repository';
import { CallMediaRepository } from './call.media.repository';
import { ScreenShareService } from './screen-share.service';
import { callLifecycle } from './call.lifecycle';
import { MessageRepository } from '@/modules/messages/message.repository';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';
import { isTerminal, resolveOutcome } from './call.state-machine';

export class CallFinalizeService {
  private callRepo = new CallRepository();
  private mediaRepo = new CallMediaRepository();
  private screenShare = new ScreenShareService();
  private messageRepo = new MessageRepository();
  private convRepo = new ConversationRepository();

  /**
   * Đóng cuộc gọi một cách idempotent:
   * - đổi status (có guard state machine)
   * - dừng mọi screen share
   * - đánh dấu participant còn lại là LEFT/MISSED
   * - ghi tin nhắn loại CALL vào conversation
   * - clear toàn bộ timer
   * - broadcast call:ended
   */
  async finalizeCall(callId: string, options: {
    status: 'ENDED' | 'MISSED' | 'REJECTED' | 'CANCELLED' | 'FAILED';
    endedBy?: string;
    endReason: string;
  }) {
    // Trong finalizeCall, khi outcome là MISSED:
if (resolveOutcome(options.status) === 'MISSED') {
  const participants = await this.callRepo.getParticipants(callId);
  const callee = participants.find(p => p.userId !== call.initiatorId);
  const initiator = participants.find(p => p.userId === call.initiatorId);
  
  if (callee && initiator) {
    await notificationService.notifyCallMissed({
      toUserId: callee.userId,
      fromUserId: call.initiatorId,
      fromDisplayName: initiator.displayName || initiator.username || 'Unknown',
      fromAvatarUrl: initiator.avatarUrl,
      callId,
      callType: call.callType as 'VOICE' | 'VIDEO',
    });
  }
}a
    const call = await this.callRepo.findById(callId);
    if (!call) return null;

    // Idempotent: đã đóng rồi thì thôi
    if (isTerminal(call.status) || call.closedAt) return call;

    callLifecycle.clearAllForCall(callId);
    await this.screenShare.forceStopForCall(callId, 'CALL_ENDED');

    const endedAt = new Date();
    const durationSeconds = call.startedAt
      ? Math.max(0, Math.round((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000))
      : 0;

    const participants = await this.callRepo.getParticipants(callId);

    // Đánh dấu participant chưa rời
    for (const p of participants) {
      if (['CONNECTED', 'JOINING', 'DISCONNECTED'].includes(p.status)) {
        await this.callRepo.updateParticipantStatus(callId, p.userId, 'LEFT');
      } else if (p.status === 'INVITED' && options.status === 'MISSED') {
        await this.callRepo.updateParticipantStatus(callId, p.userId, 'MISSED');
      }
    }

    const updated = await this.callRepo.updateCallStatus(callId, {
      status: options.status,
      endedAt,
      endedBy: options.endedBy,
      endReason: options.endReason,
      closedAt: endedAt,
    });

    await this.callRepo.logEvent({
      callId,
      userId: options.endedBy,
      eventType: `CALL_${options.status}`,
      metadata: { durationSeconds, reason: options.endReason },
    });

    // Ghi tin nhắn log vào conversation
    const logMessage = await this.writeCallLogMessage({
      callId,
      conversationId: call.conversationId,
      senderId: call.initiatorId,
      callType: call.callType,
      outcome: resolveOutcome(options.status),
      durationSeconds,
      participants: participants.map(p => ({
        userId: p.userId,
        status: p.status,
        displayName: p.displayName ?? p.username,
      })),
    });

    if (logMessage) {
      await this.callRepo.setLogMessageId(callId, logMessage.id);
    }

    // Broadcast
    const io = callLifecycle.getIO();
    const payload = {
      callId,
      status: options.status,
      endedBy: options.endedBy,
      reason: options.endReason,
      durationSeconds,
      logMessageId: logMessage?.id ?? null,
    };

    for (const p of participants) {
      io.to(`user:${p.userId}`).emit('call:ended', payload);
    }
    if (call.conversationId) {
      io.to(`conversation:${call.conversationId}`).emit('call:ended', payload);
    }

    return updated;
  }

  private async writeCallLogMessage(data: {
    callId: string;
    conversationId: string | null;
    senderId: string;
    callType: string;
    outcome: string;
    durationSeconds: number;
    participants: any[];
  }) {
    if (!data.conversationId) return null;

    const label = data.callType === 'VIDEO' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
    const content = data.outcome === 'COMPLETED'
      ? `${label} · ${this.formatDuration(data.durationSeconds)}`
      : data.outcome === 'MISSED'
        ? `${label} bị nhỡ`
        : data.outcome === 'REJECTED'
          ? `${label} bị từ chối`
          : `${label} đã hủy`;

    const message = await this.messageRepo.createMessage({
      conversationId: data.conversationId,
      senderId: data.senderId,
      content,
      messageType: 'CALL',
      metadata: {
        callId: data.callId,
        callType: data.callType,
        outcome: data.outcome,
        durationSeconds: data.durationSeconds,
        participants: data.participants,
      },
    });

    await this.convRepo.updateLastMessage(data.conversationId, {
      messageId: message.id,
      senderId: data.senderId,
      preview: content,
    });
    await this.convRepo.incrementUnreadCount(data.conversationId, data.senderId);

    const io = callLifecycle.getIO();
    io.to(`conversation:${data.conversationId}`).emit('message:new', {
      ...message,
      attachments: [],
      reactions: [],
    });

    return message;
  }

  private formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /** Dọn cuộc gọi mồ côi do server crash */
  async sweepStaleCalls(maxAgeMs: number) {
    const stale = await this.mediaRepo.findStaleCalls(maxAgeMs);
    for (const call of stale) {
      await this.finalizeCall(call.id, {
        status: 'FAILED',
        endReason: 'STALE_SWEEP',
      }).catch(err => console.error('[sweep] finalize failed', call.id, err));
    }
    return stale.length;
  }
}