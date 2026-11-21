import { Router } from 'express';
import { UserController } from './user.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import {
  updateProfileSchema,
  updateAvatarSchema,
  updateCoverSchema,
  changePasswordSchema,
  updateSettingsSchema,
} from './user.validators';

const router = Router();
const controller = new UserController();

router.use(authMiddleware);

// Profile
router.get('/me', controller.getMe);
router.get('/search', controller.searchUsers);
router.get('/:id', controller.getUser);
router.patch('/me', validate(updateProfileSchema), controller.updateProfile);
router.patch('/me/avatar', validate(updateAvatarSchema), controller.updateAvatar);
router.patch('/me/cover', validate(updateCoverSchema), controller.updateCover);

// Security
router.post('/me/change-password', validate(changePasswordSchema), controller.changePassword);

// Settings
router.get('/me/settings', controller.getSettings);
router.patch('/me/settings', validate(updateSettingsSchema), controller.updateSettings);

export default router;