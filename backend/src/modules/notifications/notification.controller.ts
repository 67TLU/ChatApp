import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';

export class NotificationController {
  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const cursor = req.query.cursor as string | undefined;
      const limit = Number(req.query.limit) || 50;

      const notifications = await notificationService.getUserNotifications(
        req.user!.userId,
        { unreadOnly, cursor, limit }
      );

      res.json({ success: true, data: notifications });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.markAsRead(
        req.user!.userId,
        req.params.id as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.markAllAsRead(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.deleteNotification(
        req.user!.userId,
        req.params.id as string
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await notificationService.getUnreadCount(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}