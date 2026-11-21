import { CallRepository } from './call.repository';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';
import { FriendshipRepository } from '@/modules/friendships/friendship.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { canTransition } from './call.state-machine';

export class CallService {
  private callRepo = new CallRepository();
  private convRepo = new ConversationRepository();
  private friendshipRepo = new FriendshipRepository();

  // ===== INITIATE CALL ======
  
  async initiateCall(initiatorId: string, data: {
    targetUserId: string;
    callType: 'VOICE' | 'VIDEO';
  }) {
    // 1. Validate: không gọi chính mình
    if (initiatorId === data.targetUserId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể gọi cho chính mình');
    }

    // 2. Check block
    const isBlocked = await this.friendshipRepo.isBlockedEitherWay(
      initiatorId,
      data.targetUserId
    );
    if (isBlocked) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Không thể gọi cho người dùng này');
    }

    // 3. Check initiator có đang trong cuộc gọi khác không
    const activeCall = await this.callRepo.findActiveCallForUser(initiatorId);
    if (activeCall) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Bạn đang trong một cuộc gọi khác');
    }

    // 4. Check target có đang trong cuộc gọi khác không
    const targetActiveCall = await this.callRepo.findActiveCallForUser(data.targetUserId);
    if (targetActiveCall) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Người dùng đang bận');
    }

    // 5. Tìm hoặc tạo conversation giữa 2 người
    const convResult = await this.convRepo.createDirectConversation(
      initiatorId,
      data.targetUserId
    );

    // 6. Tạo call session
    const call = await this.callRepo.createCall({
      callType: data.callType,
      scope: 'DIRECT',
      conversationId: convResult.id,
      initiatorId,
    });

    // 7. Thêm participants
    await this.callRepo.addParticipant({
      callId: call.id,
      userId: initiatorId,
      isHost: true,
    });
    await this.callRepo.addParticipant({
      callId: call.id,
      userId: data.targetUserId,
      isHost: false,
    });

    // 8. Update status → RINGING
    await this.callRepo.updateCallStatus(call.id, { status: 'RINGING' });

    // 9. Log event
    await this.callRepo.logEvent({
      callId: call.id,
      userId: initiatorId,
      eventType: 'CALL_INITIATED',
      metadata: { callType: data.callType },
    });

    return {
      callId: call.id,
      conversationId: convResult.id,
      callType: data.callType,
      initiatorId,
      targetUserId: data.targetUserId,
    };
  }

  // ===== ACCEPT CALL =====

  async acceptCall(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    // Validate state
    if (call.status !== 'RINGING') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cuộc gọi không thể chấp nhận');
    }

    // Check user là callee
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không phải là người được gọi');
    }

    if (participant.status !== 'INVITED') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Trạng thái không hợp lệ');
    }

    // Update participant status
    await this.callRepo.updateParticipantStatus(callId, userId, 'JOINING');

    // Update call status → ACCEPTED
    await this.callRepo.updateCallStatus(callId, {
      status: 'ACCEPTED',
      startedAt: new Date(),
    });

    // Log event
    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'CALL_ACCEPTED',
    });

    return { callId, status: 'ACCEPTED' };
  }

  // ===== REJECT CALL =====

  async rejectCall(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    if (call.status !== 'RINGING') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cuộc gọi không thể từ chối');
    }

    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền');
    }

    // Update participant
    await this.callRepo.updateParticipantStatus(callId, userId, 'REJECTED');

    // Update call status → REJECTED
    await this.callRepo.updateCallStatus(callId, {
      status: 'REJECTED',
      endedAt: new Date(),
      endedBy: userId,
      endReason: 'REJECTED',
    });

    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'CALL_REJECTED',
    });

    return { callId, status: 'REJECTED' };
  }

  // ===== CANCEL CALL (caller hủy trước khi callee accept) =====

  async cancelCall(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    if (call.initiatorId !== userId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Chỉ người gọi mới có thể hủy');
    }

    if (!['CREATED', 'RINGING'].includes(call.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cuộc gọi không thể hủy');
    }

    await this.callRepo.updateCallStatus(callId, {
      status: 'CANCELLED',
      endedAt: new Date(),
      endedBy: userId,
      endReason: 'CANCELLED',
    });

    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'CALL_CANCELLED',
    });

    return { callId, status: 'CANCELLED' };
  }

  // ===== END CALL =====

  async endCall(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    // Check user là participant
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không tham gia cuộc gọi này');
    }

    if (!['ACCEPTED', 'CONNECTED', 'RECONNECTING'].includes(call.status)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Cuộc gọi không thể kết thúc');
    }

    // Update participant status
    await this.callRepo.updateParticipantStatus(callId, userId, 'LEFT');

    // Check còn ai trong cuộc gọi không
    const activeCount = await this.callRepo.countActiveParticipants(callId);
    
    if (activeCount === 0) {
      // Không còn ai → end call
      await this.callRepo.updateCallStatus(callId, {
        status: 'ENDED',
        endedAt: new Date(),
        endedBy: userId,
        endReason: 'NORMAL',
      });

      await this.callRepo.logEvent({
        callId,
        userId,
        eventType: 'CALL_ENDED',
      });
    } else {
      await this.callRepo.logEvent({
        callId,
        userId,
        eventType: 'USER_LEFT',
      });
    }

    return { callId, ended: activeCount === 0 };
  }

  // ===== CONNECTED (WebRTC established) =====

  async markConnected(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    if (!['ACCEPTED', 'RECONNECTING'].includes(call.status)) {
      return; // Ignore
    }

    await this.callRepo.updateParticipantStatus(callId, userId, 'CONNECTED');

    // Nếu cả 2 đã connected → update call status
    const activeCount = await this.callRepo.countActiveParticipants(callId);
    if (activeCount >= 2 && call.status !== 'CONNECTED') {
      await this.callRepo.updateCallStatus(callId, { status: 'CONNECTED' });
    }

    await this.callRepo.logEvent({
      callId,
      userId,
      eventType: 'USER_CONNECTED',
    });

    return { callId, status: 'CONNECTED' };
  }

  // ===== MEDIA STATE =====

  async toggleMedia(userId: string, callId: string, data: {
    isMuted?: boolean;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
  }) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant || participant.status !== 'CONNECTED') {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không ở trong cuộc gọi');
    }

    const updated = await this.callRepo.updateParticipantMedia(callId, userId, data);

    // Log event
    if (data.isMuted !== undefined) {
      await this.callRepo.logEvent({
        callId,
        userId,
        eventType: 'MUTE_TOGGLED',
        metadata: { isMuted: data.isMuted },
      });
    }
    if (data.isVideoOn !== undefined) {
      await this.callRepo.logEvent({
        callId,
        userId,
        eventType: 'VIDEO_TOGGLED',
        metadata: { isVideoOn: data.isVideoOn },
      });
    }
    if (data.isScreenSharing !== undefined) {
      await this.callRepo.logEvent({
        callId,
        userId,
        eventType: 'SCREEN_SHARE_TOGGLED',
        metadata: { isScreenSharing: data.isScreenSharing },
      });
    }

    return updated;
  }

  // ===== MISSED CALL (timeout) =====

  async markAsMissed(callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call || call.status !== 'RINGING') return;

    await this.callRepo.updateCallStatus(callId, {
      status: 'MISSED',
      endedAt: new Date(),
      endReason: 'MISSED',
    });

    await this.callRepo.logEvent({
      callId,
      eventType: 'CALL_MISSED',
    });
  }

  // ===== GET CALL INFO =====

  async getCallInfo(userId: string, callId: string) {
    const call = await this.callRepo.findById(callId);
    if (!call) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Cuộc gọi không tồn tại');
    }

    // Check user là participant
    const participant = await this.callRepo.getParticipant(callId, userId);
    if (!participant) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem cuộc gọi này');
    }

    const participants = await this.callRepo.getParticipants(callId);
    const events = await this.callRepo.getEvents(callId);

    return {
      ...call,
      participants,
      events,
    };
  }

  async getCallHistory(userId: string, limit = 50, offset = 0) {
    return this.callRepo.getCallHistory(userId, limit, offset);
  }

  // ===== HELPER: Validate state transition =====

  isValidTransition(from: string, to: string): boolean {
    return canTransition(from, to);
  }
}