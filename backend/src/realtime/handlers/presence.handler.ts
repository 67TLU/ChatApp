import { Server, Socket } from 'socket.io';
import { PresenceManager } from '../presence/presence.manager';

export class PresenceHandler {
  private socket: Socket;
  private io: Server;
  private presenceManager: PresenceManager;

  constructor(socket: Socket, io: Server) {
    this.socket = socket;
    this.io = io;
    this.presenceManager = new PresenceManager(io);
  }

  register() {
    // Cập nhật trạng thái
    this.socket.on('presence:update', async (data) => {
      try {
        const userId = this.socket.data.userId;
        await this.presenceManager.updatePresenceStatus(
          userId,
          data.status,
          data.customStatus
        );

        this.socket.emit('presence:updated', { success: true });
      } catch (error) {
        this.socket.emit('error', { message: 'Không thể cập nhật trạng thái' });
      }
    });

    // Lấy trạng thái của users
    this.socket.on('presence:get', async (data: { userIds: string[] }) => {
      try {
        const statuses = await this.presenceManager.getPresenceStatus(data.userIds);
        this.socket.emit('presence:status', statuses);
      } catch (error) {
        this.socket.emit('error', { message: 'Không thể lấy trạng thái' });
      }
    });
  }

  async handleConnect() {
    await this.presenceManager.handleConnect(this.socket);
  }

  async handleDisconnect() {
    await this.presenceManager.handleDisconnect(this.socket);
  }
}