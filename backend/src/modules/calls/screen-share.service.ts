import { CallRepository } from './call.repository';
import { CallMediaRepository } from './call.media.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { CALL_CONFIG } from '@/config/call.config';
import { isTerminal } from './call.state-machine';

export class ScreenShareService {
  private callRepo = new CallRepository();
  private mediaRepo = new CallMediaRepository();

  async startShare(userId: string, callId: string, data: {
    sourceType?: 'SCREEN' | 'WINDOW' | 'TAB';
    withAudio?: boolean;
  }) {
    const call = await this.callRepo.findById(callId);
    if (!call || isTerminal(call.status)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không còn hoạt động');
    }

    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant || !['CONNECTED', 'JOINING'].includes(participant.status)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn chưa tham gia cuộc gọi');
    }

    // Đã share rồi → trả về share hiện tại (idempotent)
    const existing = await this.mediaRepo.findActiveShareByUser(callId, userId);
    if (existing) return { share: existing, alreadyActive: true };

    // Giới hạn số người share đồng thời
    const activeCount = await this.mediaRepo.countActiveShares(callId);
    if (activeCount >= CALL_CONFIG.MAX_CONCURRENT_SCREEN_SHARES) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'Đã có người khác đang chia sẻ màn hình. Hãy dừng trước khi bắt đầu.'
      );
    }

    const share = await this.mediaRepo.startShare({
      callId,
      userId,
      sourceType: data.sourceType ?? 'SCREEN',
      withAudio: data.withAudio ?? false,
    });

    await this.callRepo.updateParticipantMedia(callId, userId, { isScreenSharing: true });

    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'SCREEN_SHARE_STARTED',
      metadata: { shareId: share.id, sourceType: share.sourceType, withAudio: share.withAudio },
    });

    return { share, alreadyActive: false };
  }

  async stopShare(userId: string, callId: string, reason = 'USER_STOPPED') {
    const existing = await this.mediaRepo.findActiveShareByUser(callId, userId);
    if (!existing) return { share: null, alreadyStopped: true };

    const share = await this.mediaRepo.stopShare(existing.id, reason);
    await this.callRepo.updateParticipantMedia(callId, userId, { isScreenSharing: false });

    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'SCREEN_SHARE_STOPPED',
      metadata: { shareId: existing.id, reason },
    });

    return { share, alreadyStopped: false };
  }

  async getActiveShares(userId: string, callId: string) {
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không tham gia cuộc gọi này');
    }
    return this.mediaRepo.getActiveShares(callId);
  }

  /** Dùng nội bộ khi user rời phòng / disconnect / call end */
  async forceStopForUser(callId: string, userId: string, reason: string) {
    const existing = await this.mediaRepo.findActiveShareByUser(callId, userId);
    if (!existing) return null;

    await this.mediaRepo.stopShare(existing.id, reason);
    await this.callRepo.updateParticipantMedia(callId, userId, { isScreenSharing: false });
    return existing;
  }

  async forceStopForCall(callId: string, reason: string) {
    await this.mediaRepo.stopAllSharesOfCall(callId, reason);
  }
}