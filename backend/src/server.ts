import http from 'http';
import app from './app';
import { SocketServer } from './realtime/socket.server';
import { callLifecycle } from './modules/calls/call.lifecycle';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;
const httpServer = http.createServer(app);
const socketServer = new SocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Server: http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received, shutting down...`);

  // Báo client reconnect trước khi chết
  socketServer.getIO().emit('server:shutdown', { reconnectInMs: 3000 });

  callLifecycle.shutdown();

  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection at:', reason, reason.stack || reason);
  // Attempt to gracefully shut down
  process.exit(1);
});