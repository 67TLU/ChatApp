import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';

const router = Router();
const controller = new NotificationController();

router.use(authMiddleware);

router.get('/', controller.getNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.post('/read-all', controller.markAllAsRead);
router.patch('/:id/read', controller.markAsRead);
router.delete('/:id', controller.deleteNotification);

export default router;