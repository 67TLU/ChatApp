import { Server, Socket } from 'socket.io';
import { MessageService } from '@/modules/messages/message.service';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';
import { db } from '@/infrastructure/database/connection';
import { users, userProfiles } from '@/infrastructure/database/schema';
import { eq } from 'drizzle-orm';

export class MessageHandler {
  private socket: Socket;
  private io: Server;
  private messageService: MessageService;
  private convRepo: ConversationRepository;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.messageService = new MessageService();
    this.convRepo = new ConversationRepository();
  }

  register() {
    // Join conversation room khi client yêu cầu
    this.socket.on('conversation:join', async (data: { conversationId: string }) => {
      try {
        const userId = this.socket.data.userId;
        const isMember = await this.convRepo.isMember(data.conversationId, userId);
        
        if (!isMember) {
          this.socket.emit('error', { message: 'Bạn không có quyền' });
          return;
        }

        this.socket.join(`conversation:${data.conversationId}`);
        this.socket.emit('conversation:joined', { conversationId: data.conversationId });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });

    // Rời conversation room
    this.socket.on('conversation:leave', (data: { conversationId: string }) => {
      this.socket.leave(`conversation:${data.conversationId}`);
    });

    // Gửi tin nhắn
    this.socket.on('message:send', async (data) => {
      try {
        const userId = this.socket.data.userId;
        
        const result = await this.messageService.sendMessage(userId, {
          conversationId: data.conversationId,
          clientMessageId: data.clientMessageId,
          content: data.content,
          messageType: data.messageType,
          replyToMessageId: data.replyToMessageId,
        });

        if (result.isDuplicate) {
          // Client đã gửi rồi, chỉ confirm
          this.socket.emit('message:ack', {
            clientMessageId: data.clientMessageId,
            messageId: result.message.id,
          });
          return;
        }

        // Lấy thông tin sender
        const [sender] = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: userProfiles.displayName,
            avatarUrl: userProfiles.avatarUrl,
          })
          .from(users)
          .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
          .where(eq(users.id, userId));

        const messagePayload = {
          ...result.message,
          sender,
          attachments: [],
          reactions: [],
        };

        // Acknowledge cho sender
        this.socket.emit('message:ack', {
          clientMessageId: data.clientMessageId,
          messageId: result.message.id,
          createdAt: result.message.createdAt,
        });

        // Broadcast cho các members khác trong conversation
        this.socket.to(`conversation:${data.conversationId}`).emit('message:new', messagePayload);

        // Emit delivered receipt ngay lập tức cho sender
        // (trong thực tế, delivered sẽ được confirm khi client nhận được)
        
      } catch (error: any) {
        this.socket.emit('message:failed', {
          clientMessageId: data.clientMessageId,
          error: error.message,
        });
      }
    });

    // Sửa tin nhắn
    this.socket.on('message:edit', async (data) => {
      try {
        const userId = this.socket.data.userId;
        const updated = await this.messageService.editMessage(
          userId,
          data.messageId,
          data.content
        );

        this.io.to(`conversation:${updated.conversationId}`).emit('message:edited', {
          messageId: updated.id,
          content: updated.content,
          editedAt: updated.editedAt,
        });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });

    // Xóa tin nhắn
    this.socket.on('message:delete', async (data) => {
      try {
        const userId = this.socket.data.userId;
        const deleted = await this.messageService.deleteMessage(
          userId,
          data.messageId,
          data.deleteFor || 'ME'
        );

        this.io.to(`conversation:${deleted.conversationId}`).emit('message:deleted', {
          messageId: deleted.id,
          deletedBy: userId,
          deleteFor: data.deleteFor || 'ME',
        });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });

    // Đánh dấu đã đọc
    this.socket.on('message:read', async (data) => {
      try {
        const userId = this.socket.data.userId;
        
        // Update read state
        await this.convRepo.updateReadState(userId, data.conversationId, {
          lastReadMessageId: data.lastReadMessageId,
          lastReadAt: new Date(),
        });

        // Broadcast read receipt
        this.socket.to(`conversation:${data.conversationId}`).emit('message:read-receipt', {
          userId,
          conversationId: data.conversationId,
          lastReadMessageId: data.lastReadMessageId,
          readAt: new Date(),
        });

        // Confirm cho sender
        this.socket.emit('message:read-confirm', {
          conversationId: data.conversationId,
          unreadCount: 0,
        });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });

    // Reaction
    this.socket.on('message:react', async (data) => {
      try {
        const userId = this.socket.data.userId;
        
        if (data.action === 'add') {
          await this.messageService.addReaction(userId, data.messageId, data.emoji);
        } else {
          await this.messageService.removeReaction(userId, data.messageId, data.emoji);
        }

        this.io.to(`conversation:${data.conversationId}`).emit('message:reaction-updated', {
          messageId: data.messageId,
          userId,
          emoji: data.emoji,
          action: data.action,
        });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });
  }
}