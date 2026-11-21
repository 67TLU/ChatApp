import { create } from 'zustand';
import { toast } from 'sonner';
import type { CallState, CallType, IncomingCallData, CallParticipant } from '@/types/call';
import { socketService } from '@/services/socket/socket';
import { useAuthStore } from './authStore';

interface CallStoreState extends CallState {
  // Actions
  initiateCall: (targetUserId: string, callType: CallType, conversationId: string) => void;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  
  // Socket handlers
  onIncomingCall: (data: IncomingCallData) => void;
  onCallAccepted: (data: { callId: string; userId: string }) => void;
  onCallRejected: (data: { callId: string; userId: string }) => void;
  onCallEnded: (data: { callId: string; endedBy: string; reason: string }) => void;
  onMediaStateChanged: (data: { callId: string; userId: string; isMuted: boolean; isVideoOn: boolean }) => void;
   onOutgoingCall: (data: { 
    callId: string; 
    conversationId: string; 
    callType: CallType; 
    targetUserId: string;
  }) => void;
  // Reset
  resetCall: () => void;
}

const initialState: CallState = {
  callId: null,
  conversationId: null,
  callType: 'VOICE',
  status: 'IDLE',
  initiatorId: null,
  targetUserId: null,
  participants: [],
  startTime: null,
  duration: 0,
  localStream: null,
  remoteStream: null,
  screenShareStream: null,
  isMuted: false,
  isVideoOn: false,
  isScreenSharing: false,
};

export const useCallStore = create<CallStoreState>((set, get) => ({
  ...initialState,

  initiateCall: (targetUserId, callType, conversationId) => {
    const me = useAuthStore.getState().user;
    if (!me) return;

    set({
      callType,
      conversationId,
      targetUserId,
      initiatorId: me.id,
      status: 'OUTGOING',
    });

    socketService.emit('call:invite', { targetUserId, callType });
  },
  acceptCall: (callId) => {
    set({ callId, status: 'ACCEPTED' });
    socketService.emit('call:accept', { callId });
  },

  rejectCall: (callId) => {
    socketService.emit('call:reject', { callId });
    get().resetCall();
  },

  endCall: () => {
    const { callId } = get();
    if (callId) {
      socketService.emit('call:end', { callId });
    }
    
    // Cleanup media streams
    const { localStream, remoteStream, screenShareStream } = get();
    localStream?.getTracks().forEach(track => track.stop());
    remoteStream?.getTracks().forEach(track => track.stop());
    screenShareStream?.getTracks().forEach(track => track.stop());
    
    get().resetCall();
  },

  toggleMute: () => {
    const { localStream, isMuted, callId } = get();
    if (!localStream || !callId) return;

    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMuted;
      const newMuted = !isMuted;
      set({ isMuted: newMuted });
      socketService.emit('call:toggle-media', { callId, isMuted: newMuted });
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoOn, callId } = get();
    if (!localStream || !callId) return;

    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isVideoOn;
      const newVideoOn = !isVideoOn;
      set({ isVideoOn: newVideoOn });
      socketService.emit('call:toggle-media', { callId, isVideoOn: newVideoOn });
    }
  },

  toggleScreenShare: async () => {
    const { isScreenSharing, callId } = get();
    if (!callId) return;

    if (!isScreenSharing) {
      try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, audio: false,
      });
      set({ screenShareStream: stream, isScreenSharing: true });
      // ⭐ THÊM: thay track trong PC
      const pc = (window as any).__peerConnection; // cần refactor để expose
      const videoSender = pc?.getSenders().find((s: any) => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(stream.getVideoTracks()[0]);
      }
      socketService.emit('screen-share:start', { callId, sourceType: 'SCREEN' });
      stream.getVideoTracks()[0].onended = () => get().toggleScreenShare();
    } catch (error) {
      toast.error('Không thể chia sẻ màn hình');
    }
  } else {
      const { screenShareStream } = get();
      screenShareStream?.getTracks().forEach(track => track.stop());
      set({ screenShareStream: null, isScreenSharing: false });
      socketService.emit('screen-share:stop', { callId });
    }
  },
onOutgoingCall: (data: { callId: string; conversationId: string; callType: CallType; targetUserId: string }) => {
  set({
    callId: data.callId,
    conversationId: data.conversationId,
    callType: data.callType,
    targetUserId: data.targetUserId,
    status: 'OUTGOING',
  });
},

  onIncomingCall: (data) => {
    const me = useAuthStore.getState().user;
    if (!me) return;

    // Không nhận cuộc gọi từ chính mình
    if (data.caller.id === me.id) return;

    set({
      callId: data.callId,
      conversationId: data.conversationId,
      callType: data.callType,
      targetUserId: data.caller.id,
      initiatorId: data.caller.id,
      status: 'INCOMING',
    });

    // Play ringtone (optional)
    // const audio = new Audio('/sounds/ringtone.mp3');
    // audio.play();
  },

  onCallAccepted: (data) => {
    const { callId, status } = get();
    if (callId === data.callId && status === 'OUTGOING') {
      set({ status: 'ACCEPTED' });
    }
  },

  onCallRejected: (data) => {
    const { callId } = get();
    if (callId === data.callId) {
      toast.info('Cuộc gọi bị từ chối');
      get().resetCall();
    }
  },

  onCallEnded: (data) => {
    const { callId } = get();
    if (callId === data.callId) {
      // Cleanup media streams
      const { localStream, remoteStream, screenShareStream } = get();
      localStream?.getTracks().forEach(track => track.stop());
      remoteStream?.getTracks().forEach(track => track.stop());
      screenShareStream?.getTracks().forEach(track => track.stop());
      
      get().resetCall();
    }
  },

  onMediaStateChanged: (data: { callId: string; userId: string; isMuted: boolean; isVideoOn: boolean }) => {
    const { callId, participants } = get();
    if (callId !== data.callId) return;

    const updatedParticipants = participants.map(p => 
      p.userId === data.userId
        ? { ...p, isMuted: data.isMuted, isVideoOn: data.isVideoOn }
        : p
    );
    set({ participants: updatedParticipants });
  },

  resetCall: () => {
    set(initialState);
  },
}));