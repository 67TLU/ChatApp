import { z } from 'zod';
import { PERMISSIONS } from '@/common/permissions/permissions';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Tên nhóm không được để trống').max(100),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()).max(100).optional(),
  isPublic: z.boolean().optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  coverUrl: z.string().url().optional(),
  isPublic: z.boolean().optional(),
  maxMembers: z.number().int().min(2).max(10000).optional(),
  requireApproval: z.boolean().optional(),
});

export const memberActionSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  position: z.number().int().min(1).max(99),
  permissions: z.array(z.nativeEnum(PERMISSIONS as any)).min(1),
  isDefault: z.boolean().optional(),
});

export const updateRoleSchema = createRoleSchema.partial();

export const assignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export const createInviteSchema = z.object({
  maxUses: z.number().int().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const joinByCodeSchema = z.object({
  code: z.string().length(16),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

export const joinRequestSchema = z.object({
  message: z.string().max(500).optional(),
});