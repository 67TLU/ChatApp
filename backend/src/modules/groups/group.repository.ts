import { db } from '@/infrastructure/database/connection';
import { 
  groups, 
  groupRoles, 
  groupMembers, 
  groupInvitations, 
  groupBans,
  groupJoinRequests,
  conversations,
  conversationMembers,
  conversationReadStates,
  users,
  userProfiles,
} from '@/infrastructure/database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { DEFAULT_ROLE_PERMISSIONS } from '@/common/permissions/permissions';

export class GroupRepository {
  // ===== GROUPS =====
  
  async findById(groupId: string) {
    return db.query.groups.findFirst({
      where: eq(groups.id, groupId),
    });
  }

  async findByConversationId(conversationId: string) {
    return db.query.groups.findFirst({
      where: eq(groups.conversationId, conversationId),
    });
  }

  async create(data: {
    conversationId: string;
    name: string;
    ownerId: string;
    description?: string;
  }) {
    const [group] = await db.insert(groups).values(data).returning();
    return group;
  }

  async update(groupId: string, data: Partial<typeof groups.$inferInsert>) {
    const [updated] = await db.update(groups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning();
    return updated;
  }

  async delete(groupId: string) {
    await db.update(groups)
      .set({ deletedAt: new Date(), status: 'DELETED', updatedAt: new Date() })
      .where(eq(groups.id, groupId));
  }

  // ===== ROLES =====

  async createDefaultRoles(groupId: string) {
    const roles = [
      {
        groupId,
        name: 'Admin',
        description: 'Quản trị viên nhóm',
        color: '#E74C3C',
        position: 80,
        permissions: DEFAULT_ROLE_PERMISSIONS.ADMIN,
        isDefault: false,
        isSystem: true,
      },
      {
        groupId,
        name: 'Moderator',
        description: 'Kiểm duyệt viên',
        color: '#F39C12',
        position: 60,
        permissions: DEFAULT_ROLE_PERMISSIONS.MODERATOR,
        isDefault: false,
        isSystem: true,
      },
      {
        groupId,
        name: 'Member',
        description: 'Thành viên',
        color: '#3498DB',
        position: 40,
        permissions: DEFAULT_ROLE_PERMISSIONS.MEMBER,
        isDefault: true,
        isSystem: true,
      },
    ];

    await db.insert(groupRoles).values(roles);
  }

  async createRole(data: {
    groupId: string;
    name: string;
    description?: string;
    color?: string;
    position: number;
    permissions: string[];
    isDefault?: boolean;
  }) {
    const [role] = await db.insert(groupRoles).values(data).returning();
    return role;
  }

  async getRoles(groupId: string) {
    return db.query.groupRoles.findMany({
      where: eq(groupRoles.groupId, groupId),
      orderBy: [desc(groupRoles.position)],
    });
  }

  async getRole(roleId: string) {
    return db.query.groupRoles.findFirst({
      where: eq(groupRoles.id, roleId),
    });
  }

  async updateRole(roleId: string, data: Partial<typeof groupRoles.$inferInsert>) {
    const [updated] = await db.update(groupRoles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(groupRoles.id, roleId))
      .returning();
    return updated;
  }

  async deleteRole(roleId: string) {
    await db.delete(groupRoles).where(eq(groupRoles.id, roleId));
  }

  // ===== MEMBERS =====

  async addMember(data: {
    groupId: string;
    userId: string;
    roleId?: string;
    invitedBy?: string;
  }) {
    const [member] = await db.insert(groupMembers).values({
      groupId: data.groupId,
      userId: data.userId,
      roleId: data.roleId,
      status: 'ACTIVE',
      invitedBy: data.invitedBy,
    }).returning();
    return member;
  }

  async getMember(groupId: string, userId: string) {
    return db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ),
    });
  }

  async getMembers(groupId: string, options: { status?: string; limit?: number; offset?: number } = {}) {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    return db
      .select({
        userId: groupMembers.userId,
        roleId: groupMembers.roleId,
        status: groupMembers.status,
        nickname: groupMembers.nickname,
        joinedAt: groupMembers.joinedAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        roleName: groupRoles.name,
        roleColor: groupRoles.color,
      })
      .from(groupMembers)
      .leftJoin(users, eq(groupMembers.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .leftJoin(groupRoles, eq(groupMembers.roleId, groupRoles.id))
      .where(
        options.status
          ? and(eq(groupMembers.groupId, groupId), eq(groupMembers.status, options.status))
          : eq(groupMembers.groupId, groupId)
      )
      .orderBy(desc(groupMembers.joinedAt))
      .limit(limit)
      .offset(offset);
  }

  async updateMember(groupId: string, userId: string, data: Partial<typeof groupMembers.$inferInsert>) {
    const [updated] = await db.update(groupMembers)
      .set(data)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      ))
      .returning();
    return updated;
  }

async removeMember(groupId: string, userId: string) {
await db.update(groupMembers)
  .set({ status: 'LEFT' })
  .where(and(
    eq(groupMembers.groupId, groupId),
    eq(groupMembers.userId, userId)
  ));
}

  async countMembers(groupId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.status, 'ACTIVE')
      ));
    return result?.count ?? 0;
  }

  // ===== INVITATIONS =====

  async createInvite(data: {
    groupId: string;
    inviterId: string;
    inviteeId?: string;
    inviteCode?: string;
    maxUses?: number;
    expiresAt?: Date;
  }) {
    const [invite] = await db.insert(groupInvitations).values(data).returning();
    return invite;
  }

  async findInviteByCode(code: string) {
    return db.query.groupInvitations.findFirst({
      where: eq(groupInvitations.inviteCode, code),
    });
  }

  async findInviteById(inviteId: string) {
    return db.query.groupInvitations.findFirst({
      where: eq(groupInvitations.id, inviteId),
    });
  }

  async incrementInviteUsage(inviteId: string) {
    await db.update(groupInvitations)
      .set({ usedCount: sql`${groupInvitations.usedCount} + 1` })
      .where(eq(groupInvitations.id, inviteId));
  }

  async updateInviteStatus(inviteId: string, status: string) {
    await db.update(groupInvitations)
      .set({ status, actedAt: new Date() })
      .where(eq(groupInvitations.id, inviteId));
  }

  async getInvites(groupId: string) {
    return db
      .select({
        id: groupInvitations.id,
        inviteeId: groupInvitations.inviteeId,
        inviterId: groupInvitations.inviterId,
        inviteCode: groupInvitations.inviteCode,
        maxUses: groupInvitations.maxUses,
        usedCount: groupInvitations.usedCount,
        expiresAt: groupInvitations.expiresAt,
        status: groupInvitations.status,
        createdAt: groupInvitations.createdAt,
        inviterUsername: users.username,
      })
      .from(groupInvitations)
      .leftJoin(users, eq(groupInvitations.inviterId, users.id))
      .where(eq(groupInvitations.groupId, groupId))
      .orderBy(desc(groupInvitations.createdAt));
  }

  // ===== BANS =====

  async banUser(data: {
    groupId: string;
    userId: string;
    bannedBy: string;
    reason?: string;
    expiresAt?: Date;
  }) {
    const [ban] = await db.insert(groupBans).values(data).returning();
    return ban;
  }

  async unbanUser(groupId: string, userId: string) {
    await db.delete(groupBans).where(
      and(
        eq(groupBans.groupId, groupId),
        eq(groupBans.userId, userId)
      )
    );
  }

  async getBans(groupId: string) {
    return db
      .select({
        userId: groupBans.userId,
        reason: groupBans.reason,
        expiresAt: groupBans.expiresAt,
        bannedAt: groupBans.bannedAt,
        bannedByUsername: users.username,
        bannedUserUsername: sql<string>`(SELECT username FROM users WHERE id = ${groupBans.userId})`,
      })
      .from(groupBans)
      .leftJoin(users, eq(groupBans.bannedBy, users.id))
      .where(eq(groupBans.groupId, groupId))
      .orderBy(desc(groupBans.bannedAt));
  }

  async isBanned(groupId: string, userId: string) {
    const ban = await db.execute<{ exists: number }>(sql`
      SELECT 1 AS exists FROM group_bans
      WHERE group_id = ${groupId}
        AND user_id = ${userId}
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `);
    return ban.length > 0 && (ban[0] as any).exists === 1;
  }

  // ===== JOIN REQUESTS =====

  async createJoinRequest(data: {
    groupId: string;
    userId: string;
    message?: string;
  }) {
    const [request] = await db.insert(groupJoinRequests).values(data).returning();
    return request;
  }

  async getJoinRequests(groupId: string) {
    return db
      .select({
        id: groupJoinRequests.id,
        userId: groupJoinRequests.userId,
        message: groupJoinRequests.message,
        status: groupJoinRequests.status,
        createdAt: groupJoinRequests.createdAt,
        username: users.username,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
      })
      .from(groupJoinRequests)
      .leftJoin(users, eq(groupJoinRequests.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.status, 'PENDING')
      ))
      .orderBy(desc(groupJoinRequests.createdAt));
  }

  async updateJoinRequest(requestId: string, data: {
    status: string;
    reviewedBy: string;
  }) {
    const [updated] = await db.update(groupJoinRequests)
      .set({
        status: data.status,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(eq(groupJoinRequests.id, requestId))
      .returning();
    return updated;
  }

  // ===== TRANSFER OWNERSHIP =====

  async transferOwnership(groupId: string, newOwnerId: string) {
    const [updated] = await db.update(groups)
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where(eq(groups.id, groupId))
      .returning();
    return updated;
  }
}