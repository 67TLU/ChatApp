import { Router } from 'express';
import { ConversationController } from './conversation.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { createDirectSchema, createGroupSchema, markReadSchema } from './conversation.validators';

const router = Router();
const controller = new ConversationController();

router.use(authMiddleware);

router.get('/', controller.getConversations);
router.get('/:id', controller.getConversation);
router.post('/direct', validate(createDirectSchema), controller.createDirect);
router.post('/group', validate(createGroupSchema), controller.createGroup);
router.post('/:id/read', validate(markReadSchema), controller.markAsRead);

export default router;