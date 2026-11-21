import { create } from 'zustand';
import { toast } from 'sonner';
import { conversationsApi } from '@/services/api/conversations';
import { messagesApi } from '@/services/api/messages';
import { socketService } from '@/services/socket/socket';
import { useAuthStore } from './authStore';
import type { Conversation, Message } from '@/types/chat';

const newClientId = () =>
  `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

interface CursorInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

interface ChatState {
  onReadReceipt: (data: any) => void;
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;      // thứ tự CŨ → MỚI
  cursors: Record<string, CursorInfo>;
  typing: Record<string, string[]>;         // convId → userIds
  loadingConversations: boolean;
  loadingMessages: boolean;
  loadingMore: boolean;

  loadConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  closeConversation: () => void;
  loadMore: (conversationId: string) => Promise<void>;
  sendText: (conversationId: string, content: string) => Promise<void>;
  sendFiles: (conversationId: string, files: File[]) => Promise<void>;
  editText: (messageId: string, content: string) => Promise<void>;
  removeMessage: (messageId: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  createDirect: (userId: string) => Promise<string | null>;

  // socket handlers
  onAck: (p: { clientMessageId: string; messageId: string; createdAt?: string }) => void;
  onFailed: (p: { clientMessageId: string; error: string }) => void;
  onNewMessage: (m: Message) => void;
  onEdited: (p: { messageId: string; content: string; editedAt: string }) => void;
  onDeleted: (p: { messageId: string }) => void;
  onReaction: (p: { messageId: string; userId: string; emoji: string; action: 'add' | 'remove' }) => void;
  onTyping: (p: { conversationId: string; userId: string; isTyping: boolean }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  cursors: {},
  typing: {},
  loadingConversations: false,
  loadingMessages: false,
  loadingMore: false,

  loadConversations: async () => {
    set({ loadingConversations: true });
    try {
      const res = await conversationsApi.list();
      set({ conversations: res.data.data });
    } catch {
      toast.error('Không tải được danh sách hội thoại');
    } finally {
      set({ loadingConversations: false });
    }
  },

  openConversation: async (id) => {
    const prev = get().activeId;
    if (prev && prev !== id) socketService.emit('conversation:leave', { conversationId: prev });

    set({ activeId: id, loadingMessages: true });
    socketService.emit('conversation:join', { conversationId: id });

    try {
      const res = await messagesApi.list(id);
      const page = res.data.data;
      set((s) => ({
        messages: { ...s.messages, [id]: [...page.messages].reverse() },
        cursors: { ...s.cursors, [id]: { nextCursor: page.nextCursor, hasMore: page.hasMore } },
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, unreadCount: 0 } : c
        ),
      }));
      // mark read
      const list = get().messages[id] ?? [];
      const last = list[list.length - 1];
      if (last && last.status !== 'SENDING') {
        socketService.emit('message:read', { conversationId: id, lastReadMessageId: last.id });
      }
    } catch {
      toast.error('Không tải được tin nhắn');
    } finally {
      set({ loadingMessages: false });
    }
  },

  closeConversation: () => {
    const id = get().activeId;
    if (id) socketService.emit('conversation:leave', { conversationId: id });
    set({ activeId: null });
  },

  loadMore: async (conversationId) => {
    const cursor = get().cursors[conversationId];
    if (!cursor?.hasMore || get().loadingMore) return;

    set({ loadingMore: true });
    try {
      const res = await messagesApi.list(conversationId, cursor.nextCursor ?? undefined);
      const page = res.data.data;
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: [...[...page.messages].reverse(), ...(s.messages[conversationId] ?? [])],
        },
        cursors: {
          ...s.cursors,
          [conversationId]: { nextCursor: page.nextCursor, hasMore: page.hasMore },
        },
      }));
    } catch {
      toast.error('Không tải được tin nhắn cũ');
    } finally {
      set({ loadingMore: false });
    }
  },

  sendText: async (conversationId, content) => {
    const text = content.trim();
    if (!text) return;

    const me = useAuthStore.getState().user;
    if (!me) return;

    const clientMessageId = newClientId();
    const optimistic: Message = {
      id: clientMessageId,
      clientMessageId,
      conversationId,
      senderId: me.id,
      content: text,
      messageType: 'TEXT',
      status: 'SENDING',
      createdAt: new Date().toISOString(),
      attachments: [],
      reactions: [],
      sender: {
        id: me.id,
        username: me.username,
        displayName: me.displayName ?? me.username,
        avatarUrl: me.avatarUrl ?? null,
      },
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: [...(s.messages[conversationId] ?? []), optimistic],
      },
    }));

    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('message:send', { conversationId, clientMessageId, content: text });
      get().stopTyping(conversationId);
    } else {
      try {
        const res = await messagesApi.send(conversationId, { clientMessageId, content: text });
        get().onAck({
          clientMessageId,
          messageId: res.data.data.message.id,
          createdAt: res.data.data.message.createdAt,
        });
      } catch {
        get().onFailed({ clientMessageId, error: 'Gửi thất bại' });
      }
    }
  },

  sendFiles: async (conversationId, files) => {
    if (!files.length) return;
    try {
      const res = await messagesApi.upload(conversationId, files, newClientId());
      const msg = res.data.data.message;
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: [
            ...(s.messages[conversationId] ?? []),
            { ...msg, attachments: msg.attachments ?? [], reactions: [] },
          ],
        },
      }));
      toast.success('Đã gửi file');
    } catch {
      toast.error('Upload thất bại');
    }
  },

  editText: async (messageId, content) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('message:edit', { messageId, content });
    } else {
      await messagesApi.edit(messageId, content);
    }
  },

  removeMessage: async (messageId) => {
    const socket = socketService.getSocket();
    if (socket?.connected) {
      socket.emit('message:delete', { messageId, deleteFor: 'EVERYONE' });
    } else {
      await messagesApi.remove(messageId);
    }
  },

  toggleReaction: async (messageId, emoji) => {
    const state = get();
    const me = useAuthStore.getState().user;
    const convId = state.activeId;
    if (!convId || !me) return;

    const msg = (state.messages[convId] ?? []).find((m) => m.id === messageId);
    const reacted = msg?.reactions.find((r) => r.emoji === emoji)
      ?.users.some((u) => u.userId === me.id);

    socketService.emit('message:react', {
      conversationId: convId,
      messageId,
      emoji,
      action: reacted ? 'remove' : 'add',
    });
  },

  startTyping: (conversationId) => {
    socketService.emit('typing:start', { conversationId });
  },

  stopTyping: (conversationId) => {
    socketService.emit('typing:stop', { conversationId });
  },

  createDirect: async (userId) => {
    try {
      const res = await conversationsApi.createDirect(userId);
      const id = res.data.data.conversationId;
      await get().loadConversations();
      await get().openConversation(id);
      return id;
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Không tạo được hội thoại');
      return null;
    }
  },

  // ===== SOCKET HANDLERS =====

  onAck: ({ clientMessageId, messageId, createdAt }) => {
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.map((m) =>
          m.clientMessageId === clientMessageId
            ? { ...m, id: messageId, status: 'SENT', createdAt: createdAt ?? m.createdAt }
            : m
        );
      }
      return { messages: next };
    });
  },

  onFailed: ({ clientMessageId, error }) => {
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.map((m) =>
          m.clientMessageId === clientMessageId ? { ...m, status: 'FAILED' } : m
        );
      }
      return { messages: next };
    });
    toast.error(error || 'Gửi tin nhắn thất bại');
  },

onNewMessage: (m) => {
  const me = useAuthStore.getState().user;
  const { activeId } = get();
  const normalized: Message = {
    ...m,
    attachments: m.attachments ?? [],
    reactions: m.reactions ?? [],
  };

  set((s) => {
    const list = s.messages[m.conversationId] ?? [];
    // Nếu tin nhắn đã tồn tại thì không làm gì cả
    if (list.some((x) => x.id === m.id)) return s;

    // Kiểm tra xem conversation này đã có trong danh sách chưa
    const exists = s.conversations.some((c) => c.id === m.conversationId);

    return {
      messages: {
        ...s.messages,
        [m.conversationId]: [...list, normalized],
      },
      conversations: exists
        ? s.conversations.map((c) =>
            c.id === m.conversationId
              ? {
                  ...c,
                  lastMessagePreview: m.content ?? '[Tệp đính kèm]',
                  lastMessageAt: m.createdAt,
                  unreadCount:
                    activeId === m.conversationId || m.senderId === me?.id
                      ? 0
                      : (c.unreadCount ?? 0) + 1,
                }
              : c
          )
        : [
            // ⭐ Nếu chưa có, tạo mới conversation và đẩy lên đầu danh sách
            {
              id: m.conversationId,
              type: 'DIRECT', // Tạm thời gán DIRECT, backend sẽ sync đúng type sau
              name: null,
              avatarUrl: null,
              lastMessagePreview: m.content ?? '[Tệp đính kèm]',
              lastMessageAt: m.createdAt,
              unreadCount: 1,
              otherUser: m.sender
                ? {
                    userId: m.sender.id,
                    username: m.sender.username ?? 'unknown',
                    displayName: m.sender.displayName,
                    avatarUrl: m.sender.avatarUrl,
                  }
                : null,
            },
            ...s.conversations,
          ],
    };
  });

  // Tự động mark read nếu đang mở đúng conversation đó
  if (activeId === m.conversationId && m.senderId !== me?.id) {
    socketService.emit('message:read', {
      conversationId: m.conversationId,
      lastReadMessageId: m.id,
    });
  }
  },

  onReadReceipt: (data) => {
    // TODO: Implement read receipt UI
    console.log('Read receipt:', data);
  },

  onEdited: ({ messageId, content, editedAt }) => {
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.map((m) =>
          m.id === messageId ? { ...m, content, status: 'EDITED', editedAt } : m
        );
      }
      return { messages: next };
    });
  },

  onDeleted: ({ messageId }) => {
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.map((m) =>
          m.id === messageId
            ? { ...m, status: 'DELETED', content: null, deletedAt: new Date().toISOString() }
            : m
        );
      }
      return { messages: next };
    });
  },

  onReaction: ({ messageId, userId, emoji, action }) => {
    set((s) => {
      const next: Record<string, Message[]> = {};
      for (const [cid, list] of Object.entries(s.messages)) {
        next[cid] = list.map((m) => {
          if (m.id !== messageId) return m;
          let reactions = [...m.reactions];
          const idx = reactions.findIndex((r) => r.emoji === emoji);

          if (action === 'add') {
            if (idx === -1) {
              reactions.push({ emoji, count: 1, users: [{ userId, username: null, displayName: null }] });
            } else if (!reactions[idx].users.some((u) => u.userId === userId)) {
              reactions[idx] = {
                ...reactions[idx],
                count: reactions[idx].count + 1,
                users: [...reactions[idx].users, { userId, username: null, displayName: null }],
              };
            }
          } else if (idx !== -1) {
            const users = reactions[idx].users.filter((u) => u.userId !== userId);
            if (users.length === 0) reactions = reactions.filter((_, i) => i !== idx);
            else reactions[idx] = { ...reactions[idx], count: users.length, users };
          }
          return { ...m, reactions };
        });
      }
      return { messages: next };
    });
  },

  onTyping: ({ conversationId, userId, isTyping }) => {
    const me = useAuthStore.getState().user;
    if (userId === me?.id) return;
    set((s) => {
      const current = s.typing[conversationId] ?? [];
      const next = isTyping
        ? Array.from(new Set([...current, userId]))
        : current.filter((id) => id !== userId);
      return { typing: { ...s.typing, [conversationId]: next } };
    });
  },
}));