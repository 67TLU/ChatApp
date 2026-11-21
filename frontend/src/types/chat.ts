export interface MessageSender {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;      // IMAGE | VIDEO | FILE
  fileSize: number;
  mimeType: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: { userId: string; username: string | null; displayName: string | null }[];
}

export type MessageStatus = 'SENDING' | 'SENT' | 'EDITED' | 'DELETED' | 'FAILED';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId?: string | null;
  content: string | null;
  messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'SYSTEM' | 'CALL';
  replyToMessageId?: string | null;
  status: MessageStatus;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  sender?: MessageSender | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
}

export interface ConversationMember {
  userId: string;
  role: string;
  status: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string | null;
  avatarUrl: string | null;
  ownerId?: string | null;
  lastMessageId?: string | null;
  lastMessageAt?: string | null;
  lastMessagePreview?: string | null;
  lastMessageSenderId?: string | null;
  unreadCount: number;
  otherUser?: {
    userId: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  members?: ConversationMember[];
}

export interface SearchUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  presenceStatus: string;
}