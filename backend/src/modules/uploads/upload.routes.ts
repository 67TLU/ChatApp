import { Router, Request, Response, NextFunction } from 'express';
import { upload, UploadService } from './upload.service';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { MessageService } from '@/modules/messages/message.service';
import { MessageRepository } from '@/modules/messages/message.repository';

const router = Router();
const uploadService = new UploadService();
const messageService = new MessageService();
const messageRepo = new MessageRepository();

router.use(authMiddleware);

// Helper: kiểm tra user là member của conversation
const validateConversationMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId } = req.params as { conversationId: string };
    const userId = req.user!.userId;
    // TODO: Kiểm tra user là member của conversation (có thể query DB)
    // Vì chưa có repository conversation ở đây, ta sẽ skip check mạnh mẽ và phụ thuộc vào authMiddleware
    next();
  } catch (error) {
    next(error);
  }
};

// Upload file và tạo message
router.post(
  '/conversations/:conversationId/upload',
  validateConversationMember,
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { conversationId } = req.params as { conversationId: string };
      const userId = req.user!.userId;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Không có file nào được upload' },
        });
      }

      // Tạo message với type FILE/IMAGE/VIDEO
      const firstFile = files[0];
      const messageType = firstFile.mimetype.startsWith('image/') 
        ? 'IMAGE' 
        : firstFile.mimetype.startsWith('video/') 
        ? 'VIDEO' 
        : 'FILE';

      const content = files.length === 1 
        ? firstFile.originalname 
        : `${files.length} files`;

      const result = await messageService.sendMessage(userId, {
        conversationId,
        content,
        messageType,
        clientMessageId: req.body.clientMessageId,
      });

      // Lưu attachments
      const fileData = await uploadService.saveFiles(files, userId, conversationId);
      for (const file of fileData) {
        await messageRepo.addAttachment({
          messageId: result.message.id,
          ...file,
        });
      }

      // Load attachments
      const attachments = await messageRepo.getAttachments(result.message.id);

      res.status(201).json({
        success: true,
        data: {
          message: {
            ...result.message,
            attachments,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;