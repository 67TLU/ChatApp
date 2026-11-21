import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { NewMenu } from '@/components/chat/NewMenu';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import FriendsPage from '@/pages/friends/FriendsPage';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { cn, formatDate } from '@/lib/utils';
import { LogOut, MessageSquare, Users, Loader2 } from 'lucide-react';
import type { Conversation } from '@/types/chat';

export default function ChatLayout() {
  useChatSocket();
  useNotificationSocket();
  
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const {
    conversations,
    activeId,
    loadingConversations,
    loadConversations,
    openConversation,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'messages' | 'friends'>('messages');

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const title = (c: Conversation) =>
    c.type === 'GROUP'
      ? c.name ?? 'Nhóm'
      : c.otherUser?.displayName || c.otherUser?.username || 'Người dùng';

  const avatar = (c: Conversation) =>
    c.type === 'GROUP' ? c.avatarUrl : c.otherUser?.avatarUrl;

  return (
    <div className="flex h-screen bg-background">
      {/* Rail */}
      <div className="flex w-16 flex-col items-center gap-2 border-r bg-muted/30 py-3">
        <Avatar className="size-10">
          <AvatarImage src={user?.avatarUrl} />
          <AvatarFallback>{user?.username?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
        </Avatar>

        <Button
          variant={activeTab === 'messages' ? 'secondary' : 'ghost'}
          size="icon"
          className="size-12"
          onClick={() => setActiveTab('messages')}
        >
          <MessageSquare className="size-5" />
        </Button>

        <Button
          variant={activeTab === 'friends' ? 'secondary' : 'ghost'}
          size="icon"
          className="size-12"
          onClick={() => setActiveTab('friends')}
        >
          <Users className="size-5" />
        </Button>

        <NotificationBell />

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="size-12 text-destructive hover:text-destructive"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          <LogOut />
        </Button>
      </div>

      {/* Middle panel */}
      <div className="flex w-80 flex-col border-r">
        {activeTab === 'messages' ? (
          <>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-semibold">Tin nhắn</h2>
              <NewMenu />
            </div>

            <ScrollArea className="flex-1">
              {loadingConversations ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Chưa có cuộc trò chuyện.
                  <br />
                  Bấm + để bắt đầu.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      activeId === c.id && 'bg-muted'
                    )}
                  >
                    <Avatar className="size-10 shrink-0">
                      <AvatarImage src={avatar(c) ?? undefined} />
                      <AvatarFallback>{title(c)[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{title(c)}</span>
                        {c.unreadCount > 0 && (
                          <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {c.lastMessagePreview ?? 'Chưa có tin nhắn'}
                      </p>
                      {c.lastMessageAt && (
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(c.lastMessageAt)}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </>
        ) : (
          <FriendsPage />
        )}
      </div>

      {/* Chat area */}
      {activeTab === 'messages' ? (
        active ? (
          <ChatRoom conversation={active} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageSquare className="size-16 opacity-20" />
            <p>Chọn một cuộc trò chuyện để bắt đầu</p>
          </div>
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Users className="size-16 opacity-20" />
          <p>Quản lý bạn bè</p>
        </div>
      )}
    </div>
  );
}