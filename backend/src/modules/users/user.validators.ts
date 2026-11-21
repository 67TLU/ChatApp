import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(500).optional(),
  customStatus: z.string().max(100).optional(),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().url(),
});

export const updateCoverSchema = z.object({
  coverUrl: z.string().url(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const updateSettingsSchema = z.object({
  defaultPresence: z.enum(['ONLINE', 'AWAY', 'BUSY', 'DND']).optional(),
  showLastSeen: z.enum(['EVERYONE', 'FRIENDS', 'NOBODY']).optional(),
  notifyFriendRequest: z.enum(['ENABLED', 'DISABLED']).optional(),
  notifyMessage: z.enum(['ENABLED', 'DISABLED']).optional(),
  notifyCall: z.enum(['ENABLED', 'DISABLED']).optional(),
});