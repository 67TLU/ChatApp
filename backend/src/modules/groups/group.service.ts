import { GroupRepository } from './group.repository';
import { ConversationRepository } from '@/modules/conversations/conversation.repository';
import { PermissionChecker } from '@/common/permissions/permission.checker';
import { AuditService } from '@/common/services/audit.service';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';
import { PERMISSIONS } from '@/common/permissions/permissions';
import { randomBytes } from 'crypto';

export class GroupService {
  private repo = new GroupRepository();
  private convRepo = new ConversationRepository();
  private permChecker = new PermissionChecker();
  private auditService = new AuditService();

  // ===== CREATE GROUP =====
  
  async createGroup(userId: string, data: {
    name: string;
    description?: string;
    memberIds?: string[];
    isPublic?: boolean;
  }) {
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Tên nhóm không được để trống');
    }

    // 1. Tạo conversation loại GROUP
    const conv = await this.convRepo.createGroupConversation({
      name: data.name,
      ownerId: userId,
      memberIds: data.memberIds || [],
      description: data.description,
    });

    // 2. Tạo group
    const group = await this.repo.create({
      conversationId: conv.id,
      name: data.name,
      ownerId: userId,
      description: data.description,
    });

// 3. Tạo default roles
await this.repo.createDefaultRoles(group.id);

// ⭐ SỬA: Lấy role thực tế từ DB để có ID
const roles = await this.repo.getRoles(group.id);
const defaultRole = roles.find(r => r.isDefault);

await this.repo.addMember({
  groupId: group.id,
  userId,
  roleId: defaultRole?.id,
});
    // 4. Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'GROUP_CREATE',
      resourceType: 'GROUP',
      resourceId: group.id,
      newValues: { name: group.name },
    });

    return {
      groupId: group.id,
      conversationId: conv.id,
      name: group.name,
    };
  }

  // ===== GET GROUP INFO =====

  async getGroupInfo(userId: string, groupId: string) {
    const group = await this.repo.findById(groupId);
    if (!group || group.deletedAt) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Nhóm không tồn tại');
    }

    const isMember = await this.permChecker.isMember(userId, groupId);
    if (!isMember && !group.isPublic) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền xem nhóm này');
    }

    const [roles, members, memberCount] = await Promise.all([
      this.repo.getRoles(groupId),
      this.repo.getMembers(groupId, { limit: 100 }),
      this.repo.countMembers(groupId),
    ]);

    return {
      ...group,
      roles,
      members: members.filter(m => m.status === 'ACTIVE'),
      memberCount,
      isOwner: group.ownerId === userId,
    };
  }
// Thêm vào class GroupService, đặt cạnh method getGroupInfo
async getGroupByConversation(userId: string, conversationId: string) {
  const group = await this.repo.findByConversationId(conversationId);
  if (!group || group.deletedAt) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Nhóm không tồn tại');
  }
  return this.getGroupInfo(userId, group.id);
}
  // ===== UPDATE GROUP =====

  async updateGroup(userId: string, groupId: string, data: {
    name?: string;
    description?: string;
    avatarUrl?: string;
    coverUrl?: string;
    isPublic?: boolean;
    maxMembers?: number;
    requireApproval?: boolean;
  }) {
    // Check permission
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.MANAGE_GROUP
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền sửa nhóm');
    }

    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Nhóm không tồn tại');
    }

    const previousValues = { ...group };
    const updated = await this.repo.update(groupId, data);

    // Update conversation name nếu đổi tên group
    if (data.name) {
      await this.convRepo.updateConversation(group.conversationId, { name: data.name });
    }

    // Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'GROUP_UPDATE',
      resourceType: 'GROUP',
      resourceId: groupId,
      previousValues,
      newValues: data,
    });

    return updated;
  }

  // ===== DELETE GROUP =====

  async deleteGroup(userId: string, groupId: string) {
    // Chỉ owner mới có quyền xóa
    const isOwner = await this.permChecker.isOwner(userId, groupId);
    if (!isOwner) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Chỉ owner mới có quyền xóa nhóm');
    }

    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Nhóm không tồn tại');
    }

    await this.repo.delete(groupId);
  await this.convRepo.updateConversation(group.conversationId, {
    deletedAt: new Date(),
    status: 'DELETED',
  });
    // Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'GROUP_DELETE',
      resourceType: 'GROUP',
      resourceId: groupId,
    });

    return { success: true };
  }

  // ===== MEMBER MANAGEMENT =====

  async addMember(userId: string, groupId: string, targetUserId: string) {
    // Check permission
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.INVITE_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền thêm thành viên');
    }

    // Check nếu target đã là member
    const existing = await this.repo.getMember(groupId, targetUserId);
    if (existing?.status === 'ACTIVE') {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Người dùng đã là thành viên');
    }

    // Check nếu bị ban
    const isBanned = await this.repo.isBanned(groupId, targetUserId);
    if (isBanned) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Người dùng này đã bị ban');
    }

    // Check max members
    const group = await this.repo.findById(groupId);
    const memberCount = await this.repo.countMembers(groupId);
    if (group && memberCount >= group.maxMembers) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Nhóm đã đạt số lượng thành viên tối đa');
    }

    // Add member với default role
    const defaultRole = (await this.repo.getRoles(groupId)).find(r => r.isDefault);
    const member = await this.repo.addMember({
      groupId,
      userId: targetUserId,
      roleId: defaultRole?.id,
      invitedBy: userId,
    });

    // Add vào conversation
    await this.convRepo.addMember(group!.conversationId, targetUserId);

    // Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'MEMBER_ADD',
      resourceType: 'GROUP',
      resourceId: groupId,
      targetUserId,
    });

    return member;
  }

  async kickMember(userId: string, groupId: string, targetUserId: string, reason?: string) {
    // Check permission
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.KICK_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền kick thành viên');
    }

    // Không thể kick chính mình
    if (userId === targetUserId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể kick chính mình');
    }

    // Check hierarchy
    const canAct = await this.permChecker.canActOnUser(userId, targetUserId, groupId);
    if (!canAct) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tác động lên người dùng này');
    }

    const member = await this.repo.getMember(groupId, targetUserId);
    if (!member || member.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không phải là thành viên');
    }

    // Remove khỏi group
    await this.repo.removeMember(groupId, targetUserId);

    // Remove khỏi conversation
    const group = await this.repo.findById(groupId);
    if (group) {
      await this.convRepo.removeMember(group.conversationId, targetUserId);
    }

    // Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'MEMBER_KICK',
      resourceType: 'GROUP',
      resourceId: groupId,
      targetUserId,
      details: { reason },
    });

    return { success: true };
  }

  async banMember(userId: string, groupId: string, targetUserId: string, data: {
    reason?: string;
    expiresAt?: Date;
  }) {
    // Check permission
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.BAN_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền ban thành viên');
    }

    // Không thể ban chính mình
    if (userId === targetUserId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể ban chính mình');
    }

    // Check hierarchy
    const canAct = await this.permChecker.canActOnUser(userId, targetUserId, groupId);
    if (!canAct) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tác động lên người dùng này');
    }

    // Ban user
    await this.repo.banUser({
      groupId,
      userId: targetUserId,
      bannedBy: userId,
      reason: data.reason,
      expiresAt: data.expiresAt,
    });

    // Kick nếu đang là member
    const member = await this.repo.getMember(groupId, targetUserId);
    if (member?.status === 'ACTIVE') {
      await this.repo.removeMember(groupId, targetUserId);
      const group = await this.repo.findById(groupId);
      if (group) {
        await this.convRepo.removeMember(group.conversationId, targetUserId);
      }
    }

    // Audit log
    await this.auditService.log({
      actorId: userId,
      action: 'MEMBER_BAN',
      resourceType: 'GROUP',
      resourceId: groupId,
      targetUserId,
      details: { reason: data.reason, expiresAt: data.expiresAt },
    });

    return { success: true };
  }

  async unbanMember(userId: string, groupId: string, targetUserId: string) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.BAN_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền unban');
    }

    await this.repo.unbanUser(groupId, targetUserId);

    await this.auditService.log({
      actorId: userId,
      action: 'MEMBER_UNBAN',
      resourceType: 'GROUP',
      resourceId: groupId,
      targetUserId,
    });

    return { success: true };
  }

  async leaveGroup(userId: string, groupId: string) {
    // Không cho owner rời nhóm (phải transfer trước)
    const isOwner = await this.permChecker.isOwner(userId, groupId);
    if (isOwner) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Owner không thể rời nhóm. Hãy chuyển quyền sở hữu trước.');
    }

    const member = await this.repo.getMember(groupId, userId);
    if (!member || member.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Bạn không phải là thành viên');
    }

    await this.repo.removeMember(groupId, userId);

    const group = await this.repo.findById(groupId);
    if (group) {
      await this.convRepo.removeMember(group.conversationId, userId);
    }

    return { success: true };
  }

  // ===== ROLES MANAGEMENT =====

  async createRole(userId: string, groupId: string, data: {
    name: string;
    description?: string;
    color?: string;
    position: number;
    permissions: string[];
    isDefault?: boolean;
  }) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.MANAGE_ROLES
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền quản lý roles');
    }

    // Validate position (không được cao hơn owner = 100)
    if (data.position >= 100) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Position không được >= 100 (reserved for owner)');
    }

    const role = await this.repo.createRole({
      groupId,
      ...data,
    });

    await this.auditService.log({
      actorId: userId,
      action: 'ROLE_CREATE',
      resourceType: 'ROLE',
      resourceId: role.id,
      newValues: data,
    });

    return role;
  }

  async updateRole(userId: string, groupId: string, roleId: string, data: {
    name?: string;
    description?: string;
    color?: string;
    position?: number;
    permissions?: string[];
    isDefault?: boolean;
  }) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.MANAGE_ROLES
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền quản lý roles');
    }

    const role = await this.repo.getRole(roleId);
    if (!role || role.groupId !== groupId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Role không tồn tại');
    }

    // Không cho sửa system roles
    if (role.isSystem) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Không thể sửa system role');
    }

    if (data.position !== undefined && data.position >= 100) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Position không được >= 100');
    }

    const previousValues = { ...role };
    const updated = await this.repo.updateRole(roleId, data);

    await this.auditService.log({
      actorId: userId,
      action: 'ROLE_UPDATE',
      resourceType: 'ROLE',
      resourceId: roleId,
      previousValues,
      newValues: data,
    });

    return updated;
  }

  async deleteRole(userId: string, groupId: string, roleId: string) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.MANAGE_ROLES
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền quản lý roles');
    }

    const role = await this.repo.getRole(roleId);
    if (!role || role.groupId !== groupId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Role không tồn tại');
    }

    if (role.isSystem) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Không thể xóa system role');
    }

    await this.repo.deleteRole(roleId);

    await this.auditService.log({
      actorId: userId,
      action: 'ROLE_DELETE',
      resourceType: 'ROLE',
      resourceId: roleId,
    });

    return { success: true };
  }

  async assignRole(userId: string, groupId: string, targetUserId: string, roleId: string) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.MANAGE_ROLES
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền gán role');
    }

    // Check hierarchy
    const canAct = await this.permChecker.canActOnUser(userId, targetUserId, groupId);
    if (!canAct) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tác động lên người dùng này');
    }

    const role = await this.repo.getRole(roleId);
    if (!role || role.groupId !== groupId) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Role không tồn tại');
    }

    const member = await this.repo.getMember(groupId, targetUserId);
    if (!member || member.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không phải là thành viên');
    }

    await this.repo.updateMember(groupId, targetUserId, { roleId });

    await this.auditService.log({
      actorId: userId,
      action: 'ROLE_ASSIGN',
      resourceType: 'ROLE',
      resourceId: roleId,
      targetUserId,
    });

    return { success: true };
  }

  // ===== INVITATIONS =====

  async createInviteLink(userId: string, groupId: string, options: {
    maxUses?: number;
    expiresAt?: Date;
  } = {}) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.CREATE_INVITES
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền tạo invite link');
    }

    const code = randomBytes(8).toString('hex');
    const invite = await this.repo.createInvite({
      groupId,
      inviterId: userId,
      inviteCode: code,
      maxUses: options.maxUses,
      expiresAt: options.expiresAt,
    });

    return {
      inviteId: invite.id,
      inviteCode: code,
      inviteUrl: `/invite/${code}`,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
    };
  }

  async joinByInviteCode(userId: string, code: string) {
    const invite = await this.repo.findInviteByCode(code);
    if (!invite) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Invite link không tồn tại');
    }

    // Check status
    if (invite.status !== 'PENDING') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invite link không còn hiệu lực');
    }

    // Check expires
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      await this.repo.updateInviteStatus(invite.id, 'EXPIRED');
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invite link đã hết hạn');
    }

    // Check max uses
    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      await this.repo.updateInviteStatus(invite.id, 'EXPIRED');
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Invite link đã đạt số lần sử dụng tối đa');
    }

    // Check nếu đã là member
    const existing = await this.repo.getMember(invite.groupId, userId);
    if (existing?.status === 'ACTIVE') {
      throw new AppError(ErrorCodes.ALREADY_EXISTS, 'Bạn đã là thành viên của nhóm');
    }

    // Check nếu bị ban
    const isBanned = await this.repo.isBanned(invite.groupId, userId);
    if (isBanned) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn đã bị ban khỏi nhóm này');
    }

    // Add member
    const defaultRole = (await this.repo.getRoles(invite.groupId)).find(r => r.isDefault);
    await this.repo.addMember({
      groupId: invite.groupId,
      userId,
      roleId: defaultRole?.id,
      invitedBy: invite.inviterId,
    });

    // Add vào conversation
    const group = await this.repo.findById(invite.groupId);
    if (group) {
      await this.convRepo.addMember(group.conversationId, userId);
    }

    // Increment usage
    await this.repo.incrementInviteUsage(invite.id);

    return {
      groupId: invite.groupId,
      groupName: group?.name,
    };
  }

  // ===== TRANSFER OWNERSHIP =====

  async transferOwnership(userId: string, groupId: string, newOwnerId: string) {
    // Chỉ owner mới có quyền transfer
    const isOwner = await this.permChecker.isOwner(userId, groupId);
    if (!isOwner) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Chỉ owner mới có quyền chuyển quyền sở hữu');
    }

    if (userId === newOwnerId) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không thể chuyển quyền cho chính mình');
    }

    // New owner phải là member
    const newOwnerMember = await this.repo.getMember(groupId, newOwnerId);
    if (!newOwnerMember || newOwnerMember.status !== 'ACTIVE') {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Người dùng không phải là thành viên');
    }

    // Transfer
    await this.repo.transferOwnership(groupId, newOwnerId);

    // Update conversation owner
    const group = await this.repo.findById(groupId);
    if (group) {
      await this.convRepo.updateConversation(group.conversationId, { ownerId: newOwnerId });
    }

    await this.auditService.log({
      actorId: userId,
      action: 'OWNER_TRANSFER',
      resourceType: 'GROUP',
      resourceId: groupId,
      targetUserId: newOwnerId,
    });

    return { success: true };
  }

  // ===== JOIN REQUESTS =====

  async requestToJoin(userId: string, groupId: string, message?: string) {
    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Nhóm không tồn tại');
    }

    if (!group.isPublic) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Nhóm không công khai');
    }

    if (!group.requireApproval) {
      // Join trực tiếp
      const defaultRole = (await this.repo.getRoles(groupId)).find(r => r.isDefault);
      await this.repo.addMember({
        groupId,
        userId,
        roleId: defaultRole?.id,
      });
      await this.convRepo.addMember(group.conversationId, userId);
      return { joined: true };
    }

    // Tạo join request
    const request = await this.repo.createJoinRequest({
      groupId,
      userId,
      message,
    });

    return { requestId: request.id, requiresApproval: true };
  }

  async approveJoinRequest(userId: string, groupId: string, requestId: string) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.INVITE_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền duyệt');
    }

    const request = (await this.repo.getJoinRequests(groupId)).find(r => r.id === requestId);
    if (!request) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Request không tồn tại');
    }

    await this.repo.updateJoinRequest(requestId, {
      status: 'APPROVED',
      reviewedBy: userId,
    });

    // Add member
    const defaultRole = (await this.repo.getRoles(groupId)).find(r => r.isDefault);
    await this.repo.addMember({
      groupId,
      userId: request.userId,
      roleId: defaultRole?.id,
      invitedBy: userId,
    });

    const group = await this.repo.findById(groupId);
    if (group) {
      await this.convRepo.addMember(group.conversationId, request.userId);
    }

    return { success: true };
  }

  async rejectJoinRequest(userId: string, groupId: string, requestId: string) {
    const hasPermission = await this.permChecker.hasPermission(
      userId,
      groupId,
      PERMISSIONS.INVITE_MEMBERS
    );
    if (!hasPermission) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Bạn không có quyền từ chối');
    }

    await this.repo.updateJoinRequest(requestId, {
      status: 'REJECTED',
      reviewedBy: userId,
    });

    return { success: true };
  }
}