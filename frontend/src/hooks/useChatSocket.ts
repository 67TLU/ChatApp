import { useEffect } from 'react';
import { socketService } from '@/services/socket/socket';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types/chat';
import { useUserStore } from '@/stores/userStore';
import { useFriendStore } from '@/stores/friendStore';

export function useChatSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cleanup: (() => void) | null = null;

    const attach = () => {
      const socket = socketService.getSocket();
      if (!socket) return false;

      const store = useChatStore.getState();

      const onAck = (p: any) => store.onAck(p);
      const onFailed = (p: any) => store.onFailed(p);
      const onNew = (m: Message) => store.onNewMessage(m);
      const onEdited = (p: any) => store.onEdited(p);
      const onDeleted = (p: any) => store.onDeleted(p);
      const onReaction = (p: any) => store.onReaction(p);
      const onTyping = (p: any) => store.onTyping(p);
      const onConnect = () => {
        const activeId = useChatStore.getState().activeId;
        if (activeId) socket.emit('conversation:join', { conversationId: activeId });
      };
// socket.on('presence:changed', (data) => useUserStore.getState().onPresenceChanged(data));
// socket.on('friend:request:received', (data) => useFriendStore.getState().onFriendRequest(data));
// socket.on('message:read-receipt', (data) => useChatStore.getState().onReadReceipt(data));
      socket.on('message:ack', onAck);
      socket.on('message:failed', onFailed);
      socket.on('message:new', onNew);
      socket.on('message:edited', onEdited);
      socket.on('message:deleted', onDeleted);
      socket.on('message:reaction-updated', onReaction);
      socket.on('typing:update', onTyping);
      socket.on('connect', onConnect);

      cleanup = () => {
        socket.off('message:ack', onAck);
        socket.off('message:failed', onFailed);
        socket.off('message:new', onNew);
        socket.off('message:edited', onEdited);
        socket.off('message:deleted', onDeleted);
        socket.off('message:reaction-updated', onReaction);
        socket.off('typing:update', onTyping);
        socket.off('connect', onConnect);
      };
      return true;
    };

    // socket có thể connect sau khi effect chạy → thử lại vài lần
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