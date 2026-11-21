import { Request, Response, NextFunction } from 'express';
import { ConversationService } from './conversation.service';
import { createDirectSchema, createGroupSchema, markReadSchema } from './conversation.validators';

export class ConversationController {
  private service = new ConversationService();

  getConversations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const conversations = await this.service.getUserConversations(
        req.user!.userId,
        limit,
        offset
      );

      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  };

  getConversation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const conversation = await this.service.getConversationDetails(
        req.user!.userId,
        req.params.id as string
      );

      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  };

  createDirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createDirectSchema.parse(req.body);
      const result = await this.service.getOrCreateDirectConversation(
        req.user!.userId,
        data.userId
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  createGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createGroupSchema.parse(req.body);
      const result = await this.service.createGroupConversation(
        req.user!.userId,
        data
      );

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = markReadSchema.parse(req.body);
      const result = await this.service.markAsRead(
        req.user!.userId,
        req.params.id as string,
        data.lastMessageId
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}