import { Router } from 'express';
import { FriendshipController } from './friendship.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { sendFriendRequestSchema, blockUserSchema } from './friendship.validators';

const router = Router();
const controller = new FriendshipController();

// Tất cả routes đều cần auth
router.use(authMiddleware);

// Friendships
router.get('/', controller.getFriends);
router.get('/requests/received', controller.getReceivedRequests);
router.get('/requests/sent', controller.getSentRequests);
router.get('/relationship/:userId', controller.getRelationship);

router.post('/request', validate(sendFriendRequestSchema), controller.sendRequest);
router.post('/accept/:id', controller.acceptRequest);
router.post('/reject/:id', controller.rejectRequest);
router.post('/cancel/:id', controller.cancelRequest);
router.delete('/:id', controller.removeFriend);

// Blocks
router.get('/blocks', controller.getBlockedList);
router.post('/blocks', validate(blockUserSchema), controller.blockUser);
router.delete('/blocks/:userId', controller.unblockUser);

export default router;