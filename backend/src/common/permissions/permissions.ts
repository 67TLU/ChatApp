// Danh sách tất cả permissions có thể có
export const PERMISSIONS = {
  // Group management
  MANAGE_GROUP: 'MANAGE_GROUP',           // Sửa thông tin nhóm
  DELETE_GROUP: 'DELETE_GROUP',           // Xóa nhóm
  MANAGE_ROLES: 'MANAGE_ROLES',           // Quản lý roles
  TRANSFER_OWNERSHIP: 'TRANSFER_OWNERSHIP', // Chuyển quyền owner
  
  // Member management
  INVITE_MEMBERS: 'INVITE_MEMBERS',       // Mời thành viên
  KICK_MEMBERS: 'KICK_MEMBERS',           // Kick thành viên
  BAN_MEMBERS: 'BAN_MEMBERS',             // Ban thành viên
  REMOVE_MESSAGES: 'REMOVE_MESSAGES',     // Xóa tin nhắn của người khác
  
  // Content
  SEND_MESSAGES: 'SEND_MESSAGES',         // Gửi tin nhắn
  UPLOAD_FILES: 'UPLOAD_FILES',           // Upload file
  PIN_MESSAGES: 'PIN_MESSAGES',           // Ghim tin nhắn
  MENTION_ALL: 'MENTION_ALL',             // Mention @everyone
  
  // Voice/Video
  START_CALL: 'START_CALL',               // Bắt đầu cuộc gọi
  MUTE_OTHERS: 'MUTE_OTHERS',             // Mute người khác
  REMOVE_FROM_CALL: 'REMOVE_FROM_CALL',   // Remove khỏi cuộc gọi
  
  // Invites
  CREATE_INVITES: 'CREATE_INVITES',       // Tạo invite link
  MANAGE_INVITES: 'MANAGE_INVITES',       // Quản lý invites
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Default permissions cho từng role
export const DEFAULT_ROLE_PERMISSIONS = {
  OWNER: Object.values(PERMISSIONS), // Tất cả permissions
  
  ADMIN: [
    PERMISSIONS.MANAGE_GROUP,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.INVITE_MEMBERS,
    PERMISSIONS.KICK_MEMBERS,
    PERMISSIONS.BAN_MEMBERS,
    PERMISSIONS.REMOVE_MESSAGES,
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.PIN_MESSAGES,
    PERMISSIONS.MENTION_ALL,
    PERMISSIONS.START_CALL,
    PERMISSIONS.MUTE_OTHERS,
    PERMISSIONS.REMOVE_FROM_CALL,
    PERMISSIONS.CREATE_INVITES,
    PERMISSIONS.MANAGE_INVITES,
  ],
  
  MODERATOR: [
    PERMISSIONS.INVITE_MEMBERS,
    PERMISSIONS.KICK_MEMBERS,
    PERMISSIONS.BAN_MEMBERS,
    PERMISSIONS.REMOVE_MESSAGES,
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.PIN_MESSAGES,
    PERMISSIONS.START_CALL,
    PERMISSIONS.CREATE_INVITES,
  ],
  
  MEMBER: [
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.UPLOAD_FILES,
    PERMISSIONS.START_CALL,
    PERMISSIONS.CREATE_INVITES,
  ],
};

// Role hierarchy (position cao hơn có quyền cao hơn)
export const ROLE_HIERARCHY = {
  OWNER: 100,
  ADMIN: 80,
  MODERATOR: 60,
  MEMBER: 40,
};