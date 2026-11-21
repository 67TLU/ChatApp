import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { socketAuthMiddleware } from './socket.middleware';
import { MessageHandler } from './handlers/message.handler';
import { TypingHandler } from './handlers/typing.handler';
import { PresenceHandler } from './handlers/presence.handler';
import { CallHandler } from './handlers/call.handler';
import { CallMediaHandler } from './handlers/call-media.handler';
import { callLifecycle } from '@/modules/calls/call.lifecycle';
import { CallFinalizeService } from '@/modules/calls/call.finalize.service';
import { CALL_CONFIG } from '@/config/call.config';
import { notificationService } from '@/modules/notifications/notification.service';
import { NotificationHandler } from './handlers/notification.handler';

export class SocketServer {
  private io: Server;

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
      },
      pingTimeout: 20_000,
      pingInterval: 10_000,
      maxHttpBufferSize: 1e6,
    });

    // ⭐ Set IO SAU KHI khởi tạo this.io
    notificationService.setIO(this.io);

    // ⭐ Lifecycle cần io để broadcast
    callLifecycle.init(this.io);

    // ⭐ Dọn cuộc gọi mồ côi
    const finalize = new CallFinalizeService();
    callLifecycle.startSweep(async () => {
      const n = await finalize.sweepStaleCalls(CALL_CONFIG.STALE_CALL_MAX_AGE_MS);
      if (n > 0) console.log(`[call-sweep] đóng ${n} cuộc gọi mồ côi`);
    });

    this.io.use(socketAuthMiddleware);
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', async (socket: Socket) => {
      const userId = socket.data.userId;
      socket.join(`user:${userId}`);

      // ⭐ NotificationHandler tạo TRONG callback, nơi có socket
      const notificationHandler = new NotificationHandler(socket, this.io);
      notificationHandler.register();

      const messageHandler = new MessageHandler(socket, this.io);
      const typingHandler = new TypingHandler(socket, this.io);
      const presenceHandler = new PresenceHandler(socket, this.io);
      const callHandler = new CallHandler(socket, this.io);
      const callMediaHandler = new CallMediaHandler(socket, this.io);

      messageHandler.register();
      typingHandler.register();
      presenceHandler.register();
      callHandler.register();
      callMediaHandler.register();

      await presenceHandler.handleConnect().catch(console.error);

      socket.on('disconnect', async () => {
        await presenceHandler.handleDisconnect();
        // ⭐ Không end call ngay — cho grace period
        await callHandler.handleDisconnect().catch(console.error);
      });
    });
  }

  getIO() { return this.io; }
}