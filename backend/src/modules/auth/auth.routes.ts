import { Router } from 'express';
import { AuthController } from './auth.controller';
import { AuthVerificationController } from './auth.verification.controller';
import { validate } from '@/common/middleware/validate.middleware';
import { loginSchema, registerSchema } from './auth.validators';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { rateLimit } from 'express-rate-limit';

const router = Router();
const authController = new AuthController();
const verifyController = new AuthVerificationController();

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: { success: false, error: { message: 'Quá nhiều lần đăng nhập sai, vui lòng thử lại sau 15 phút' } },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour
  message: { success: false, error: { message: 'Quá nhiều yêu cầu đăng ký, vui lòng thử lại sau 1 giờ' } },
});

// Auth routes
router.post('/register', validate(registerSchema), registerLimiter, authController.register);
router.post('/login', validate(loginSchema), loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware, authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);

// Verification routes
router.post('/send-verification', verifyController.sendVerificationEmail);
router.post('/verify-email', verifyController.verifyEmail);
router.post('/forgot-password', verifyController.forgotPassword);
router.get('/validate-reset-token', verifyController.validateResetToken);
router.post('/reset-password', verifyController.resetPassword);

export default router;