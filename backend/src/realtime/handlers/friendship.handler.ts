import { Server, Socket } from 'socket.io';
import { FriendshipService } from '@/modules/friendships/friendship.service';

export class FriendshipHandler {
  private socket: Socket;
  private io: Server;
  private service: FriendshipService;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.service = new FriendshipService();
  }

  register() {
    // Gửi lời mời kết bạn (có thể qua socket hoặc REST)
    this.socket.on('friend:request', async (data) => {
      try {
        const userId = this.socket.data.userId;
        const result = await this.service.sendFriendRequest(
          userId,
          data.addresseeId,
          data.message
        );

        // Thông báo cho người nhận
        this.io.to(`user:${data.addresseeId}`).emit('friend:request:received', {
          friendshipId: result.friendshipId,
          fromUser: {
            id: userId,
            // TODO: Thêm thông tin user
          },
          message: data.message,
        });

        this.socket.emit('friend:request:sent', { success: true, ...result });
      } catch (error: any) {
        this.socket.emit('error', { message: error.message });
      }
    });
  }
}