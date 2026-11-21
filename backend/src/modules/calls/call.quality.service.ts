import { CallMediaRepository } from './call.media.repository';
import { CallRepository } from './call.repository';
import { CALL_CONFIG } from '@/config/call.config';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

// Throttle in-memory: `${callId}:${userId}` → timestamp
const lastReportAt = new Map<string, number>();

export class CallQualityService {
  private mediaRepo = new CallMediaRepository();
  private callRepo = new CallRepository();

  async reportQuality(userId: string, callId: string, stats: {
    rttMs?: number;
    packetLoss?: number;
    jitterMs?: number;
    bitrateKbps?: number;
    frameWidth?: number;
    frameHeight?: number;
    framesPerSecond?: number;
  }) {
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant || !['CONNECTED', 'JOINING'].includes(participant.status)) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không ở trong cuộc gọi');
    }

    // Throttle
    const key = `${callId}:${userId}`;
    const now = Date.now();
    const last = lastReportAt.get(key) ?? 0;
    if (now - last < CALL_CONFIG.QUALITY_REPORT_MIN_INTERVAL_MS) {
      return { throttled: true, quality: participant.connectionQuality };
    }
    lastReportAt.set(key, now);

    const quality = this.evaluate(stats);

    // Chỉ lưu mẫu khi chất lượng thay đổi hoặc mỗi ~30s
    const shouldPersist =
      participant.connectionQuality !== quality ||
      now - last > 30_000;

    if (shouldPersist) {
      await this.mediaRepo.saveQuality({ callId, userId, ...stats, quality });
      await this.mediaRepo.updateParticipantQuality(callId, userId, quality);
    }

    await this.mediaRepo.heartbeat(callId, userId);

    return { throttled: false, quality, changed: participant.connectionQuality !== quality };
  }

  private evaluate(stats: { rttMs?: number; packetLoss?: number }): 'GOOD' | 'MODERATE' | 'POOR' {
    const t = CALL_CONFIG.QUALITY_THRESHOLDS;
    const rtt = stats.rttMs ?? 0;
    const loss = stats.packetLoss ?? 0;

    if (rtt >= t.POOR_RTT_MS || loss >= t.POOR_PACKET_LOSS) return 'POOR';
    if (rtt >= t.MODERATE_RTT_MS || loss >= t.MODERATE_PACKET_LOSS) return 'MODERATE';
    return 'GOOD';
  }

  async getSummary(userId: string, callId: string) {
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không tham gia cuộc gọi này');
    }
    return this.mediaRepo.getQualitySummary(callId);
  }

  static clearThrottle(callId: string, userId: string) {
    lastReportAt.delete(`${callId}:${userId}`);
  }
}