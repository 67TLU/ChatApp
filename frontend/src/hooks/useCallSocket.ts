import { useEffect } from 'react';
import { socketService } from '@/services/socket/socket';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import type { IncomingCallData, CallType } from '@/types/call';

export function useCallSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = socketService.getSocket();
      if (!socket) return false;
// Sửa dòng 18:

      const store = useCallStore.getState();
      const onOutgoing = (data: { 
  callId: string; 
  conversationId: string; 
  callType: CallType; 
  targetUserId: string;
}) => store.onOutgoingCall(data);
      const onIncoming = (data: IncomingCallData) => store.onIncomingCall(data);
      const onAccepted = (data: { callId: string; userId: string }) => store.onCallAccepted(data);
      const onRejected = (data: { callId: string; userId: string }) => store.onCallRejected(data);
      const onEnded = (data: { callId: string; endedBy: string; reason: string }) => store.onCallEnded(data);
      const onMediaState = (data: { callId: string; userId: string; isMuted: boolean; isVideoOn: boolean }) => 
        store.onMediaStateChanged(data);
socket.on('call:outgoing', onOutgoing);
      socket.on('call:incoming', onIncoming);
      socket.on('call:accepted', onAccepted);
      socket.on('call:rejected', onRejected);
      socket.on('call:ended', onEnded);
      socket.on('call:media-state-changed', onMediaState);

      cleanup = () => {
        socket.off('call:outgoing', onOutgoing);
        socket.off('call:incoming', onIncoming);
        socket.off('call:accepted', onAccepted);
        socket.off('call:rejected', onRejected);
        socket.off('call:ended', onEnded);
        socket.off('call:media-state-changed', onMediaState);
      };

      return true;
    };

    if (!attach()) {
      const timer = setInterval(() => {
        if (attach()) clearInterval(timer);
      }, 300);
      return () => {
        clearInterval(timer);
        cleanup?.();
      };
    }

    return () => cleanup?.();
  }, [isAuthenticated]);
}