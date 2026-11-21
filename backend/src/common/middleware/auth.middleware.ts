import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '@/common/utils/jwt';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Thiếu access token',401);
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AppError(ErrorCodes.INVALID_TOKEN, 'Access token không hợp lệ',401);
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(ErrorCodes.UNAUTHORIZED, 'Xác thực thất bại'));
    }
  }
};