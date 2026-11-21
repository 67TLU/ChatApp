import { pgTable, uuid, varchar, timestamp, text, boolean, integer, jsonb, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { conversations } from './conversation';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

// Groups - Thông tin nhóm (liên kết 1-1 với conversation loại GROUP)
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().default(uuid7),
  conversationId: uuid('conversation_id').notNull().unique().references(() => conversations.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  coverUrl: varchar('cover_url', { length: 500 }),
  
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  
  // Cài đặt
  isPublic: boolean('is_public').default(false).notNull(),
  maxMembers: integer('max_members').default(500).notNull(),
  requireApproval: boolean('require_approval').default(false).notNull(),
  
  // Trạng thái
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  // ACTIVE, SUSPENDED, DELETED
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    ownerIdx: index('idx_groups_owner').on(table.ownerId),
    statusIdx: index('idx_groups_status').on(table.status),
    convUniqueIdx: uniqueIndex('idx_groups_conv').on(table.conversationId),
  };
});

// Group Roles - Vai trò trong nhóm (dùng JSONB cho permissions)
export const groupRoles = pgTable('group_roles', {
  id: uuid('id').primaryKey().default(uuid7),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  
  name: varchar('name', { length: 50 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 7 }), // Hex color '#FF5733'
  position: integer('position').default(0).notNull(), // Thứ tự hierarchy
  
  // Permissions dưới dạng JSONB array
  permissions: jsonb('permissions').default([]).notNull(),
  // ["MANAGE_GROUP", "KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_ROLES", 
  //  "DELETE_MESSAGES", "SEND_MESSAGES", "UPLOAD_FILES", "CREATE_INVITES", ...]
  
  isDefault: boolean('is_default').default(false).notNull(), // Role mặc định cho member mới
  isSystem: boolean('is_system').default(false).notNull(), // Role hệ thống không xóa được
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    groupIdx: index('idx_group_roles_group').on(table.groupId, table.position),
    uniqueNameIdx: uniqueIndex('uq_group_role_name').on(table.groupId, table.name),
  };
});

// Group Members - Thành viên nhóm
export const groupMembers = pgTable('group_members', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  roleId: uuid('role_id').references(() => groupRoles.id, { onDelete: 'set null' }),
  
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  // ACTIVE, INVITED, BANNED, LEFT
  
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  invitedBy: uuid('invited_by').references(() => users.id),
  bannedAt: timestamp('banned_at'),
  bannedBy: uuid('banned_by').references(() => users.id),
  banReason: text('ban_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.groupId, table.userId] }),
    userIdx: index('idx_group_members_user').on(table.userId, table.status),
    roleIdx: index('idx_group_members_role').on(table.groupId, table.roleId),
  };
});

// Group Invitations - Lời mời vào nhóm (có thể qua link)
export const groupInvitations = pgTable('group_invitations', {
  id: uuid('id').primaryKey().default(uuid7),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  
  // Mời user cụ thể hoặc qua link
  inviteeId: uuid('invitee_id').references(() => users.id, { onDelete: 'cascade' }),
  inviterId: uuid('inviter_id').notNull().references(() => users.id),
  
  // Invite link
  inviteCode: varchar('invite_code', { length: 32 }).unique(),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  // PENDING, ACCEPTED, REJECTED, EXPIRED, REVOKED
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  actedAt: timestamp('acted_at'),
}, (table) => {
  return {
    groupIdx: index('idx_group_invites_group').on(table.groupId, table.status),
    userIdx: index('idx_group_invites_user').on(table.inviteeId, table.status),
    codeIdx: index('idx_group_invites_code').on(table.inviteCode),
  };
});

// Group Bans - Danh sách banned
export const groupBans = pgTable('group_bans', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  bannedBy: uuid('banned_by').notNull().references(() => users.id),
  reason: text('reason'),
  expiresAt: timestamp('expires_at'), // NULL = ban vĩnh viễn
  
  bannedAt: timestamp('banned_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.groupId, table.userId] }),
  };
});

// Join Requests - Yêu cầu tham gia nhóm (cho nhóm public)
export const groupJoinRequests = pgTable('group_join_requests', {
  id: uuid('id').primaryKey().default(uuid7),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  message: text('message'),
  
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  // PENDING, APPROVED, REJECTED
  
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    groupIdx: index('idx_join_requests_group').on(table.groupId, table.status),
    userIdx: index('idx_join_requests_user').on(table.userId),
    uniquePendingIdx: uniqueIndex('uq_join_request_pending').on(table.groupId, table.userId).where(sql`status = 'PENDING'`),
  };
});