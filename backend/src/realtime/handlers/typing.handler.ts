import { Server, Socket } from 'socket.io';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';

// Lưu typing state: conversationId → Map<userId, timeout>
const typingStates = new Map<string, Map<string, NodeJS.Timeout>>();

export class TypingHandler {
  private socket: Socket;
  private io: Server;
  private convRepo: ConversationRepository;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.convRepo = new ConversationRepository();
  }

  register() {
    // Bắt đầu gõ
    this.socket.on('typing:start', async (data: { conversationId: string }) => {
      try {
        const userId = this.socket.data.userId;
        const isMember = await this.convRepo.isMember(data.conversationId, userId);
        if (!isMember) return;

        // Lưu typing state
        if (!typingStates.has(data.conversationId)) {
          typingStates.set(data.conversationId, new Map());
        }
        const convTyping = typingStates.get(data.conversationId)!;

        // Clear timeout cũ nếu có
        const oldTimeout = convTyping.get(userId);
        if (oldTimeout) clearTimeout(oldTimeout);

        // Set timeout tự động stop sau 5 giây
        const timeout = setTimeout(() => {
          this.handleTypingStop(data.conversationId, userId);
        }, 5000);
        convTyping.set(userId, timeout);

        // Broadcast
        this.socket.to(`conversation:${data.conversationId}`).emit('typing:update', {
          conversationId: data.conversationId,
          userId,
          isTyping: true,
        });
      } catch (error) {
        // Silent fail
      }
    });

    // Dừng gõ
    this.socket.on('typing:stop', async (data: { conversationId: string }) => {
      try {
        const userId = this.socket.data.userId;
        this.handleTypingStop(data.conversationId, userId);
      } catch (error) {
        // Silent fail
      }
    });
  }

  private handleTypingStop(conversationId: string, userId: string) {
    const convTyping = typingStates.get(conversationId);
    if (!convTyping) return;

    const timeout = convTyping.get(userId);
    if (timeout) clearTimeout(timeout);
    convTyping.delete(userId);

    if (convTyping.size === 0) {
      typingStates.delete(conversationId);
    }

    this.io.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      isTyping: false,
    });
  }
}