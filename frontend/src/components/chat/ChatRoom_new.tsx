import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import { Phone, Video } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import { GroupInfoSheet } from '@/components/groups/GroupInfoSheet';
import { useState } from 'react';
import { Info } from 'lucide-react';
export function ChatRoom({ conversation }: { conversation: Conversation }) {
  const user = useAuthStore((s) => s.user);
  const {
    messages, cursors, typing, loadingMessages, loadingMore,
    loadMore, sendText, sendFiles, editText, removeMessage, toggleReaction,
    startTyping, stopTyping,
  } = useChatStore();
  const [infoOpen, setInfoOpen] = useState(false);
  const { initiateCall } = useCallStore();

  const list = messages[conversation.id] ?? [];
  const cursor = cursors[conversation.id] ?? { hasMore: false, nextCursor: null };
  const typingUsers = typing[conversation.id] ?? [];

  const title = conversation.type === 'GROUP'
    ? conversation.name ?? 'NhÃ³m'
    : conversation.otherUser?.displayName || conversation.otherUser?.username || 'NgÆ°á»i dÃ¹ng';

  const avatar = conversation.type === 'GROUP'
    ? conversation.avatarUrl
    : conversation.otherUser?.avatarUrl;

  const otherUserId = conversation.type === 'DIRECT'
    ? conversation.otherUser?.userId
    : null;

  const handleVoiceCall = () => {
    if (!otherUserId) return;
    initiateCall(otherUserId, 'VOICE', conversation.id);
  };

  const handleVideoCall = () => {
    if (!otherUserId) return;
    initiateCall(otherUserId, 'VIDEO', conversation.id);
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Avatar className="size-9">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback>{title[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          {conversation.type === 'GROUP' && (
            <p className="text-xs text-muted-foreground">NhÃ³m chat</p>
          )}
        </div>

        {/* Call buttons (chá»‰ hiá»‡n khi lÃ  DIRECT chat) */}
        {conversation.type === 'DIRECT' && otherUserId && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVoiceCall}
              title="Gá»i thoáº¡i"
            >
              <Phone className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVideoCall}
              title="Gá»i video"
            >
              <Video className="size-5" />
            </Button>
          </div>
        )}
      </div>

      <MessageList
        messages={list}
        currentUserId={user?.id ?? ''}
        loading={loadingMessages}
        loadingMore={loadingMore}
        hasMore={cursor.hasMore}
        onLoadMore={() => loadMore(conversation.id)}
        onEdit={(id, content) => editText(id, content)}
        onDelete={(id) => removeMessage(id)}
        onReact={(id, emoji) => toggleReaction(id, emoji)}
      />

      {typingUsers.length > 0 && (
        <p className="px-4 pb-1 text-xs text-muted-foreground">
          Äang nháº­p tin nháº¯nâ€¦
        </p>
      )}

      <ChatInput
        onSend={(text) => sendText(conversation.id, text)}
        onSendFiles={(files) => sendFiles(conversation.id, files)}
        onTypingStart={() => startTyping(conversation.id)}
        onTypingStop={() => stopTyping(conversation.id)}
      />
    </div>
  );
}
