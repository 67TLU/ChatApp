import { Request, Response, NextFunction } from 'express';
import { CallService } from './call.service';
import * as validators from './call.validators';

export class CallController {
  private service = new CallService();

  getCallHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = validators.callHistorySchema.parse(req.query);
      const history = await this.service.getCallHistory(
        req.user!.userId,
        limit,
        offset
      );

      res.json({ success: true, data: history });
    } catch (error) {
      next(error);
    }
  };

  getCallInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = req.params as { callId: string };
      const info = await this.service.getCallInfo(req.user!.userId, callId);

      res.json({ success: true, data: info });
    } catch (error) {
      next(error);
    }
  };
}