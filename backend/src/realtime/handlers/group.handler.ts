import { Server, Socket } from 'socket.io';
import { GroupService } from '@/modules/groups/group.service';

export class GroupHandler {
  private socket: Socket;
  private io: Server;
  private service: GroupService;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.service = new GroupService();
  }

  register() {
    // Member joined
    this.socket.on('group:member-joined', async (data: { groupId: string }) => {
      try {
        const userId = this.socket.data.userId;
        
        // Join conversation room
        this.socket.join(`group:${data.groupId}`);

        // Notify others
        this.socket.to(`group:${data.groupId}`).emit('group:member-joined', {
          groupId: data.groupId,
          userId,
        });
      } catch (error) {
        // Silent
      }
    });

    // Member left
    this.socket.on('group:member-left', async (data: { groupId: string }) => {
      try {
        const userId = this.socket.data.userId;
        
        this.socket.leave(`group:${data.groupId}`);

        this.io.to(`group:${data.groupId}`).emit('group:member-left', {
          groupId: data.groupId,
          userId,
        });
      } catch (error) {
        // Silent
      }
    });
  }

  // Helper để emit group events từ service
  static emitToGroup(io: Server, groupId: string, event: string, data: any) {
    io.to(`group:${groupId}`).emit(event, data);
  }
}