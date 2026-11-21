import { Socket } from 'socket.io';
import { verifyAccessToken } from '@/common/utils/jwt';

export const socketAuthMiddleware = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return next(new Error('Invalid token'));
    }

    socket.data.userId = payload.userId;
    socket.data.email = payload.email;
    socket.data.roles = payload.roles;

    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};