import { Request, Response, NextFunction } from 'express';
import { AuthVerificationService } from './auth.verification.service';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

export class AuthVerificationController {
  private service = new AuthVerificationService();

  sendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.sendVerificationEmail(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      const result = await this.service.verifyEmail(token);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await this.service.forgotPassword(email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  validateResetToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Token là bắt buộc' },
        });
      }
      const result = await this.service.validateResetToken(token);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      const result = await this.service.resetPassword(token, newPassword);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };
}