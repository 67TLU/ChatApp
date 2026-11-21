import { io, Socket } from 'socket.io-client';
import { config } from '@/config/env';
import { useAuthStore } from '@/stores/authStore';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if(this.socket?.connected) return true
    const token = useAuthStore.getState().accessToken;
    
    if (!token) {
      console.warn('Cannot connect socket: No access token');
      return;
    }

    this.socket = io(config.socketUrl, {
        auth: () => ({ token }),
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10, // Tăng số lần thử kết nối
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      // Nếu disconnect do token expired (401), cố gắng reconnect với token mới
      if (reason === 'unauthorized' || reason === 'token expired') {
        this.forceReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  }

  private async forceReconnect() {
    // Đợi một chút rồi thử kết nối lại với token mới từ store
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Lấy token mới từ store và kết nối lại
    this.connect();
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  getSocket() {
    return this.socket;
  }

  emit(event: string, data?: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

export const socketService = new SocketService();