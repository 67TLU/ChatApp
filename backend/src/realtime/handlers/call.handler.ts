import { Server, Socket } from 'socket.io';
import { CallService } from '@/modules/calls/call.service';
import { CallRepository } from '@/modules/calls/call.repository';
import { db } from '@/infrastructure/database/connection';
import { users, userProfiles } from '@/infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import { callLifecycle } from '@/modules/calls/call.lifecycle';
import { CallFinalizeService } from '@/modules/calls/call.finalize.service';
import { ScreenShareService } from '@/modules/calls/screen-share.service';
import { CallReconnectionService } from '@/modules/calls/call.reconnection.service';
import { MediaSettingsService } from '@/modules/calls/media-settings.service';
import { CALL_CONFIG } from '@/config/call.config';

export class CallHandler {
  private socket: Socket;
  private io: Server;
  private callService: CallService;
  private callRepo: CallRepository;
  private finalize = new CallFinalizeService();
  private screenShare = new ScreenShareService();
  private reconnection = new CallReconnectionService();
  private mediaSettings = new MediaSettingsService();

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.callService = new CallService();
    this.callRepo = new CallRepository();
  }


  register() {
    // ===== INVITE (giữ logic cũ, thay phần timeout) =====
    this.socket.on('call:invite', async (data) => {
      try {
        const initiatorId = this.socket.data.userId;
        const call = await this.callService.initiateCall(initiatorId, data);

        const [initiator] = await db.select({
          id: users.id,
          username: users.username,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
        })
          .from(users)
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(eq(users.id, initiatorId));

        // Caller nhận ICE config + media constraints đã lưu
        const settings = await this.mediaSettings.getSettings(initiatorId);

        this.socket.emit('call:outgoing', {
          callId: call.callId,
          conversationId: call.conversationId,
          callType: call.callType,
          targetUserId: data.targetUserId,
          mediaConstraints: settings.mediaConstraints,
          joinMuted: settings.joinMuted,
          joinVideoOff: settings.joinVideoOff,
        });

        this.io.to(`user:${data.targetUserId}`).emit('call:incoming', {
          callId: call.callId,
          conversationId: call.conversationId,
          callType: call.callType,
          caller: initiator,
          ringingTimeoutMs: CALL_CONFIG.RINGING_TIMEOUT_MS,
        });

        // ⭐ Timeout tập trung
        callLifecycle.startRinging(call.callId, async () => {
          await this.finalize.finalizeCall(call.callId, {
            status: 'MISSED',
            endReason: 'RINGING_TIMEOUT',
          });
        });
      } catch (error: any) {
        this.socket.emit('call:error', { code: error.code, error: error.message });
      }
    });

    // ===== ACCEPT =====
    this.socket.on('call:accept', async (data: { callId: string }) => {
      try {
        const userId = this.socket.data.userId;
        await this.callService.acceptCall(userId, data.callId);
        callLifecycle.clearRinging(data.callId);

        const call = await this.callRepo.findById(data.callId);
        if (!call) return;

        const settings = await this.mediaSettings.getSettings(userId);

        this.io.to(`user:${call.initiatorId}`).emit('call:accepted', {
          callId: data.callId, userId,
        });

        this.socket.emit('call:accept-confirm', {
          callId: data.callId,
          initiatorId: call.initiatorId,
          callType: call.callType,
          mediaConstraints: settings.mediaConstraints,
          joinMuted: settings.joinMuted,
          joinVideoOff: settings.joinVideoOff,
        });
      } catch (error: any) {
        this.socket.emit('call:error', { code: error.code, error: error.message });
      }
    });

    // ===== REJECT =====
    this.socket.on('call:reject', async (data: { callId: string }) => {
      try {
    const userId = this.socket.data.userId;
    await this.callService.rejectCall(userId, data.callId);
    const call = await this.callRepo.findById(data.callId);
    if (!call) return;
    // ⭐ THÊM: broadcast cho caller
    this.io.to(`user:${call.initiatorId}`).emit('call:rejected', {
      callId: data.callId,
      userId,
    });
    await this.finalize.finalizeCall(data.callId, {
      status: 'REJECTED',
      endReason: 'CALLER_REJECTED',
    });
  } catch (error: any) {
        this.socket.emit('call:error', { code: error.code, error: error.message });
      }
    });

    // ===== CANCEL =====
    this.socket.on('call:cancel', async (data: { callId: string }) => {
      try {
        const userId = this.socket.data.userId;
        await this.callService.cancelCall(userId, data.callId);
        await this.finalize.finalizeCall(data.callId, {
          status: 'CANCELLED', endedBy: userId, endReason: 'CANCELLED',
        });
      } catch (error: any) {
        this.socket.emit('call:error', { code: error.code, error: error.message });
      }
    });

    // ===== END =====
    this.socket.on('call:end', async (data: { callId: string }) => {
      try {
        const userId = this.socket.data.userId;
        const call = await this.callRepo.findById(data.callId);
        if (!call) return;

        // Kiểm tra user là participant của cuộc gọi
        const participant = await this.callRepo.getParticipant(data.callId, userId);
        if (!participant) {
          this.socket.emit('call:error', { code: 'PARTICIPANT_NOT_FOUND', error: 'Bạn không phải participant của cuộc gọi này' });
          return;
        }

        await this.screenShare.forceStopForUser(data.callId, userId, 'USER_LEFT');
        callLifecycle.clearReconnectGrace(data.callId, userId);

        // P2P: 1 người bấm kết thúc → kết thúc toàn bộ
        if (call.scope === 'DIRECT') {
          await this.finalize.finalizeCall(data.callId, {
            status: 'ENDED', endedBy: userId, endReason: 'NORMAL',
          });
        } else {
          const result = await this.callService.endCall(userId, data.callId);
          if (result.ended) {
            await this.finalize.finalizeCall(data.callId, {
              status: 'ENDED', endedBy: userId, endReason: 'ALL_LEFT',
            });
          }
        }
      } catch (error: any) {
        this.socket.emit('call:error', { code: error.code || 'END_ERROR', error: error.message });
      }
    });

    // ===== SIGNAL (giữ nguyên giai đoạn 5) =====
    this.socket.on('call:signal', async (data) => {
      try {
        const participant = await this.callRepo.getParticipant(data.callId, this.socket.data.userId);
        if (!participant) return;

        // Chặn signal tới người không cùng cuộc gọi
        const target = await this.callRepo.getParticipant(data.callId, data.targetUserId);
        if (!target) return;

        this.io.to(`user:${data.targetUserId}`).emit('call:signal', {
          callId: data.callId,
          fromUserId: this.socket.data.userId,
          signal: data.signal,
        });
      } catch (error: any) {
        this.socket.emit('call:error', { code: error.code || 'SIGNAL_ERROR', error: error.message });
      }
    });

    // ===== MEDIA STATE (giữ nguyên) =====
    this.socket.on('call:toggle-media', async (data) => {
      try {
        const userId = this.socket.data.userId;
        await this.callService.toggleMedia(userId, data.callId, {
          isMuted: data.isMuted,
          isVideoOn: data.isVideoOn,
        });

        const participants = await this.callRepo.getParticipants(data.callId);
        for (const p of participants) {
          if (p.userId === userId) continue;
          this.io.to(`user:${p.userId}`).emit('call:media-state-changed', {
            callId: data.callId, userId,
            isMuted: data.isMuted, isVideoOn: data.isVideoOn,
          });
        }
      } catch (error: any) {
        this.socket.emit('call:error', { error: error.message });
      }
    });

    // ===== WEBRTC CONNECTED =====
    this.socket.on('call:webrtc-connected', async (data: { callId: string }) => {
      try {
        await this.callService.markConnected(this.socket.data.userId, data.callId);
        callLifecycle.clearReconnectGrace(data.callId, this.socket.data.userId);
      } catch {
        // silent
      }
    });
  }

  async handleDisconnect() {
    await this.reconnection.handleDisconnect(this.socket.data.userId);
  }
}