import { z } from 'zod';

export const sendMessageSchema = z.object({
  clientMessageId: z.string().max(64).optional(),
  content: z.string().max(10000).optional(),
  messageType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'FILE', 'SYSTEM']).optional(),
  replyToMessageId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
}).refine(
  data => data.content || (data.attachmentIds && data.attachmentIds.length > 0),
  { message: 'Tin nhắn không được để trống' }
);

export const editMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const deleteMessageSchema = z.object({
  deleteFor: z.enum(['ME', 'EVERYONE']).default('ME'),
});

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(32),
});