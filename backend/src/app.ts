import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import groupRoutes from './modules/groups/group.routes';
import authRoutes from './modules/auth/auth.routes';
import friendshipRoutes from './modules/friendships/friendship.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import messageRoutes from './modules/messages/message.routes';
import uploadRoutes from './modules/uploads/upload.routes';
import callRoutes from './modules/calls/call.routes';
import { errorMiddleware } from './common/middleware/error.middleware';
import userRoutes from './modules/users/user.routes';
import notificationRoutes from './modules/notifications/notification.routes';

const app = express();

// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' } },
});
app.use('/api', limiter);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cho phép load ảnh từ URL
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendshipRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api', messageRoutes);
app.use('/api', uploadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/groups', groupRoutes);
// Error handling
app.use(errorMiddleware);

export default app;