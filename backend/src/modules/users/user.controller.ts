import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import {
  updateProfileSchema,
  updateAvatarSchema,
  updateCoverSchema,
  changePasswordSchema,
  updateSettingsSchema,
} from './user.validators';

export class UserController {
  private service = new UserService();

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await this.service.getProfile(req.user!.userId, req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate UUID format
      const userId = req.params.id as string;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]-[89ab][0-9a-f]-[0-9a-f]{12}$/i.test(userId)) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'ID người dùng không hợp lệ');
      }
      const profile = await this.service.getProfile(userId, req.user!.userId);
      res.json({ success: true, data: profile });
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateProfileSchema.parse(req.body);
      const result = await this.service.updateProfile(req.user!.userId, data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateAvatarSchema.parse(req.body);
      const result = await this.service.updateAvatar(req.user!.userId, data.avatarUrl);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateCover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateCoverSchema.parse(req.body);
      const result = await this.service.updateCover(req.user!.userId, data.coverUrl);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req.query.q as string) || '';
      const limit = Number(req.query.limit) || 20;
      const users = await this.service.searchUsers(query, req.user!.userId, limit);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = changePasswordSchema.parse(req.body);
      const result = await this.service.changePassword(req.user!.userId, data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await this.service.getSettings(req.user!.userId);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = updateSettingsSchema.parse(req.body);
      const result = await this.service.updateSettings(req.user!.userId, data);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}