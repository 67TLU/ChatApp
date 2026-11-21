import { db } from '@/infrastructure/database/connection';
import { groups, groupMembers, groupRoles, conversations, users } from '@/infrastructure/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ROLE_HIERARCHY } from './permissions';

export class PermissionChecker {
  // Lấy role hierarchy position của user trong group
  async getUserRolePosition(userId: string, groupId: string): Promise<number | null> {
    // Check nếu là owner
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });
    if (group?.ownerId === userId) {
      return ROLE_HIERARCHY.OWNER;
    }

    // Check role của member
    const member = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, 'ACTIVE')
      ),
    });

    if (!member) return null;

    if (member.roleId) {
      const role = await db.query.groupRoles.findFirst({
        where: eq(groupRoles.id, member.roleId),
      });
      return role?.position ?? ROLE_HIERARCHY.MEMBER;
    }

    return ROLE_HIERARCHY.MEMBER;
  }

  // Kiểm tra user có permission cụ thể không
  async hasPermission(userId: string, groupId: string, permission: string): Promise<boolean> {
    // Owner có tất cả permissions
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });
    if (group?.ownerId === userId) return true;

    // Check member status
    const member = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, 'ACTIVE')
      ),
    });

    if (!member) return false;

    // Check role permissions
    if (member.roleId) {
      const role = await db.query.groupRoles.findFirst({
        where: eq(groupRoles.id, member.roleId),
      });
      const permissions = (role?.permissions as string[]) || [];
      return permissions.includes(permission);
    }

    // Fallback: check default role của group
    const defaultRole = await db.query.groupRoles.findFirst({
      where: and(
        eq(groupRoles.groupId, groupId),
        eq(groupRoles.isDefault, true)
      ),
    });

    if (defaultRole) {
      const permissions = (defaultRole.permissions as string[]) || [];
      return permissions.includes(permission);
    }

    return false;
  }

  // Kiểm tra user1 có thể tác động lên user2 không (dựa trên hierarchy)
  async canActOnUser(
    actorId: string,
    targetId: string,
    groupId: string
  ): Promise<boolean> {
    const actorPosition = await this.getUserRolePosition(actorId, groupId);
    const targetPosition = await this.getUserRolePosition(targetId, groupId);

    if (actorPosition === null) return false;
    if (targetPosition === null) return true; // Target không phải member

    // Actor phải có position cao hơn target
    return actorPosition > targetPosition;
  }

  // Kiểm tra user có phải owner không
  async isOwner(userId: string, groupId: string): Promise<boolean> {
    const group = await db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });
    return group?.ownerId === userId;
  }

  // Kiểm tra user có phải member không
  async isMember(userId: string, groupId: string): Promise<boolean> {
    const member = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId),
        eq(groupMembers.status, 'ACTIVE')
      ),
    });
    return !!member;
  }

  // Kiểm tra user có bị ban không
  async isBanned(userId: string, groupId: string): Promise<boolean> {
    const ban = await db.execute<{ exists: number }>(sql`
      SELECT 1 AS exists FROM group_bans 
      WHERE group_id = ${groupId} 
        AND user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    return ban.length > 0 && (ban[0] as any).exists === 1;
  }
}

export const permissionChecker = new PermissionChecker();