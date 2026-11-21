import { Request, Response, NextFunction } from 'express';
import { MessageService } from './message.service';
import { 
  sendMessageSchema, 
  editMessageSchema, 
  deleteMessageSchema,
  reactionSchema,
} from './message.validators';

export class MessageController {
  private service = new MessageService();

  getMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const cursor = req.query.cursor as string | undefined;
      const limit = Number(req.query.limit) || 50;

      const result = await this.service.getMessages(
        req.user!.userId,
        conversationId,
        cursor,
        limit
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const data = sendMessageSchema.parse(req.body);

      const result = await this.service.sendMessage(req.user!.userId, {
        conversationId,
        ...data,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  editMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params as { messageId: string };
      const data = editMessageSchema.parse(req.body);

      const result = await this.service.editMessage(
        req.user!.userId,
        messageId,
        data.content
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params as { messageId: string };
      const data = deleteMessageSchema.parse(req.body);

      const result = await this.service.deleteMessage(
        req.user!.userId,
        messageId,
        data.deleteFor
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  addReaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params as { messageId: string };
      const data = reactionSchema.parse(req.body);

      const result = await this.service.addReaction(
        req.user!.userId,
        messageId,
        data.emoji
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  removeReaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId, emoji } = req.params as { messageId: string; emoji: string };

      const result = await this.service.removeReaction(
        req.user!.userId,
        messageId,
        decodeURIComponent(emoji)
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  pinMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params as { messageId: string };
      const result = await this.service.pinMessage(req.user!.userId, messageId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  unpinMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { messageId } = req.params as { messageId: string };
      const result = await this.service.unpinMessage(req.user!.userId, messageId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getPins = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const pins = await this.service.getPins(req.user!.userId, conversationId);
      res.json({ success: true, data: pins });
    } catch (error) {
      next(error);
    }
  };
}