export interface GroupRole {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  permissions: string[];
  isDefault: boolean;
  isSystem: boolean;
}

export interface GroupMember {
  userId: string;
  roleId: string | null;
  status: string;
  nickname: string | null;
  joinedAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  roleName: string | null;
  roleColor: string | null;
}

export interface Group {
  id: string;
  conversationId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  ownerId: string;
  isPublic: boolean;
  maxMembers: number;
  requireApproval: boolean;
  status: string;
  roles?: GroupRole[];
  members?: GroupMember[];
  memberCount?: number;
  isOwner?: boolean;
  createdAt: string;
  updatedAt: string;
}