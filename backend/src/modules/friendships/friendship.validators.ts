import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  addresseeId: z.string().uuid('ID người dùng không hợp lệ'),
  message: z.string().max(200).optional(),
});

export const friendshipIdSchema = z.object({
  id: z.string().uuid('ID không hợp lệ'),
});

export const blockUserSchema = z.object({
  userId: z.string().uuid('ID người dùng không hợp lệ'),
  reason: z.string().max(200).optional(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});