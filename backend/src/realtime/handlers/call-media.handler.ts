import { Server, Socket } from 'socket.io';
import { ScreenShareService } from '@/modules/calls/screen-share.service';
import { CallReconnectionService } from '@/modules/calls/call.reconnection.service';
import { CallQualityService } from '@/modules/calls/call.quality.service';
import { MediaSettingsService } from '@/modules/calls/media-settings.service';
import { CallRepository } from '@/modules/calls/call.repository';
import * as v from '@/modules/calls/call.media.validators';

export class CallMediaHandler {
  private screenShare = new ScreenShareService();
  private reconnection = new CallReconnectionService();
  private quality = new CallQualityService();
  private mediaSettings = new MediaSettingsService();
  private callRepo = new CallRepository();

  constructor(private socket: Socket, private io: Server) {}

  private get userId(): string {
    return this.socket.data.userId;
  }

  private fail(error: any, scope = 'call') {
    this.socket.emit(`${scope}:error`, {
      code: error.code ?? 'INTERNAL_ERROR',
      error: error.message ?? 'Có lỗi xảy ra',
    });
  }

  private async broadcastToPeers(callId: string, event: string, payload: any) {
    const participants = await this.callRepo.getParticipants(callId);
    for (const p of participants) {
      if (p.userId === this.userId) continue;
      this.io.to(`user:${p.userId}`).emit(event, payload);
    }
  }

  register() {
    // ===== RESUME / RECONNECT =====

    this.socket.on('call:resume', async (raw) => {
      try {
        const { callId } = v.resumeCallSchema.parse(raw);
        const snapshot = await this.reconnection.resumeCall(this.userId, callId);
        this.socket.emit('call:resumed', snapshot);
      } catch (error) {
        this.fail(error);
      }
    });

    this.socket.on('call:active', async () => {
      try {
        const calls = await this.reconnection.getActiveCalls(this.userId);
        this.socket.emit('call:active-list', { calls });
      } catch (error) {
        this.fail(error);
      }
    });

    this.socket.on('call:heartbeat', async (raw) => {
      try {
        const { callId } = v.callIdParamSchema.parse(raw);
        await this.callRepo.heartbeat?.(callId, this.userId);
      } catch {
        // silent
      }
    });

    // ===== SCREEN SHARE =====

    this.socket.on('screen-share:start', async (raw) => {
      try {
        const data = v.startScreenShareSchema.parse(raw);
        const { share, alreadyActive } = await this.screenShare.startShare(
          this.userId, data.callId,
          { sourceType: data.sourceType, withAudio: data.withAudio }
        );

        this.socket.emit('screen-share:started', {
          callId: data.callId,
          shareId: share.id,
          sourceType: share.sourceType,
          withAudio: share.withAudio,
          alreadyActive,
        });

        if (!alreadyActive) {
          await this.broadcastToPeers(data.callId, 'screen-share:peer-started', {
            callId: data.callId,
            userId: this.userId,
            shareId: share.id,
            sourceType: share.sourceType,
            withAudio: share.withAudio,
          });
        }
      } catch (error) {
        this.fail(error, 'screen-share');
      }
    });

    this.socket.on('screen-share:stop', async (raw) => {
      try {
        const { callId } = v.stopScreenShareSchema.parse(raw);
        const { share, alreadyStopped } = await this.screenShare.stopShare(this.userId, callId);

        this.socket.emit('screen-share:stopped', { callId, shareId: share?.id ?? null });

        if (!alreadyStopped) {
          await this.broadcastToPeers(callId, 'screen-share:peer-stopped', {
            callId, userId: this.userId, reason: 'USER_STOPPED',
          });
        }
      } catch (error) {
        this.fail(error, 'screen-share');
      }
    });

    this.socket.on('screen-share:list', async (raw) => {
      try {
        const { callId } = v.callIdParamSchema.parse(raw);
        const shares = await this.screenShare.getActiveShares(this.userId, callId);
        this.socket.emit('screen-share:active-list', { callId, shares });
      } catch (error) {
        this.fail(error, 'screen-share');
      }
    });

    // ===== QUALITY =====

    this.socket.on('call:quality-report', async (raw) => {
      try {
        const { callId, ...stats } = v.qualityReportSchema.parse(raw);
        const result = await this.quality.reportQuality(this.userId, callId, stats);

        if (!result.throttled && result.changed) {
          this.socket.emit('call:quality-updated', { callId, quality: result.quality });
          await this.broadcastToPeers(callId, 'call:peer-quality', {
            callId, userId: this.userId, quality: result.quality,
          });
        }
      } catch {
        // Quality report không quan trọng → silent
      }
    });

    // ===== DEVICE SWITCH =====

    this.socket.on('call:device-changed', async (raw) => {
      try {
        const data = v.switchDeviceSchema.parse(raw);

        // Lưu lại làm device mặc định cho lần sau
        const patch: any = {};
        if (data.kind === 'AUDIO_INPUT') {
          patch.audioInputId = data.deviceId;
          patch.audioInputLabel = data.label ?? null;
        } else if (data.kind === 'AUDIO_OUTPUT') {
          patch.audioOutputId = data.deviceId;
          patch.audioOutputLabel = data.label ?? null;
        } else {
          patch.videoInputId = data.deviceId;
          patch.videoInputLabel = data.label ?? null;
        }
        await this.mediaSettings.updateSettings(this.userId, patch);

        // Peer cần biết để renegotiate (camera đổi → track mới)
        await this.broadcastToPeers(data.callId, 'call:peer-device-changed', {
          callId: data.callId,
          userId: this.userId,
          kind: data.kind,
          // Client sẽ gửi offer mới qua call:signal
          renegotiationRequired: data.kind === 'VIDEO_INPUT',
        });

        this.socket.emit('call:device-changed-confirm', { kind: data.kind, deviceId: data.deviceId });
      } catch (error) {
        this.fail(error);
      }
    });

    // ===== RENEGOTIATION (screen share / device change) =====
    // Dùng lại kênh call:signal của giai đoạn 5, thêm cờ renegotiation
    this.socket.on('call:renegotiate', async (raw: {
      callId: string; targetUserId: string; reason: string;
    }) => {
      const participant = await this.callRepo.getParticipant(raw.callId, this.userId);
      if (!participant) return;

      this.io.to(`user:${raw.targetUserId}`).emit('call:renegotiate-requested', {
        callId: raw.callId,
        fromUserId: this.userId,
        reason: raw.reason, // 'SCREEN_SHARE_START' | 'SCREEN_SHARE_STOP' | 'DEVICE_CHANGE'
      });
    });
  }
}