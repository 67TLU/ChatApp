import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, registerSchema } from './auth.validators';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

export class AuthController {
  private service = new AuthService();

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await this.service.register(data);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Đăng ký thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = loginSchema.parse(req.body);
      const result = await this.service.login({
        email: data.email,
        password: data.password,
        deviceInfo: {
          deviceType: req.headers['x-device-type'] as string,
          deviceName: req.headers['x-device-name'] as string,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      // Set refresh token in httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        throw new AppError(ErrorCodes.INVALID_TOKEN, 'Refresh token không tồn tại');
      }

      const result = await this.service.refreshTokens(refreshToken);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) {
        await this.service.logout(refreshToken);
      }

      res.clearCookie('refreshToken');
      res.json({
        success: true,
        message: 'Đăng xuất thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      await this.service.logoutAll(userId);

      res.clearCookie('refreshToken');
      res.json({
        success: true,
        message: 'Đã đăng xuất khỏi tất cả thiết bị',
      });
    } catch (error) {
      next(error);
    }
  };
}