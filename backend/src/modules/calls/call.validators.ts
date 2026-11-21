import { z } from 'zod';

export const initiateCallSchema = z.object({
  targetUserId: z.string().uuid(),
  callType: z.enum(['VOICE', 'VIDEO']),
});

export const callIdSchema = z.object({
  callId: z.string().uuid(),
});

export const toggleMediaSchema = z.object({
  callId: z.string().uuid(),
  isMuted: z.boolean().optional(),
  isVideoOn: z.boolean().optional(),
  isScreenSharing: z.boolean().optional(),
});

export const callHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});