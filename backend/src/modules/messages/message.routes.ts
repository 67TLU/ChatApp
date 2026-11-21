import { Router } from 'express';
import { MessageController } from './message.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { sendMessageSchema, editMessageSchema, deleteMessageSchema, reactionSchema } from './message.validators';

const router = Router();
const controller = new MessageController();

router.use(authMiddleware);

// Messages trong conversation
router.get('/conversations/:conversationId/messages', controller.getMessages);
router.post('/conversations/:conversationId/messages', validate(sendMessageSchema), controller.sendMessage);

// Actions trên message
router.patch('/messages/:messageId', validate(editMessageSchema), controller.editMessage);
router.delete('/messages/:messageId', validate(deleteMessageSchema), controller.deleteMessage);

// Reactions
router.post('/messages/:messageId/reactions', validate(reactionSchema), controller.addReaction);
router.delete('/messages/:messageId/reactions/:emoji', controller.removeReaction);

// Pins
router.get('/conversations/:conversationId/pins', controller.getPins);
router.post('/messages/:messageId/pin', controller.pinMessage);
router.delete('/messages/:messageId/pin', controller.unpinMessage);

export default router;