import { z } from 'zod';

export const createDirectSchema = z.object({
  userId: z.string().uuid('ID người dùng không hợp lệ'),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Tên nhóm không được để trống').max(100),
  memberIds: z.array(z.string().uuid()).min(1, 'Cần ít nhất 1 thành viên'),
  description: z.string().max(500).optional(),
});

export const markReadSchema = z.object({
  lastMessageId: z.string().uuid(),
});