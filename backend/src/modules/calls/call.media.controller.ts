import { Request, Response, NextFunction } from 'express';
import { MediaSettingsService } from './media-settings.service';
import { CallReconnectionService } from './call.reconnection.service';
import { CallQualityService } from './call.quality.service';
import { ScreenShareService } from './screen-share.service';
import * as v from './call.media.validators';

export class CallMediaController {
  private settings = new MediaSettingsService();
  private reconnection = new CallReconnectionService();
  private quality = new CallQualityService();
  private screenShare = new ScreenShareService();

  getMediaSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.settings.getSettings(req.user!.userId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };

  updateMediaSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = v.updateMediaSettingsSchema.parse(req.body);
      const data = await this.settings.updateSettings(req.user!.userId, body);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };

  getActiveCalls = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.reconnection.getActiveCalls(req.user!.userId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };

  resumeCall = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = v.callIdParamSchema.parse(req.params);
      const data = await this.reconnection.resumeCall(req.user!.userId, callId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };

  getQualitySummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = v.callIdParamSchema.parse(req.params);
      const data = await this.quality.getSummary(req.user!.userId, callId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };

  getActiveScreenShares = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { callId } = v.callIdParamSchema.parse(req.params);
      const data = await this.screenShare.getActiveShares(req.user!.userId, callId);
      res.json({ success: true, data });
    } catch (e) { next(e); }
  };
}