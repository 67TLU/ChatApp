import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useFriendStore } from '@/stores/friendStore';
import { useChatStore } from '@/stores/chatStore';
import {
  Search, UserPlus, UserCheck, UserX, X, Check,
  Clock, Ban, Loader2, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface FriendUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  presenceStatus: string;
}

interface FriendRequest {
  friendshipId: string;
  requesterId?: string;
  addresseeId?: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  message: string | null;
  createdAt: string;
}

interface Block {
  blockedId: string;
  reason: string | null;
  blockedAt: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// ============================================================================
// Main Component
// ============================================================================

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('friends');

  const {
    friends,
    receivedRequests,
    sentRequests,
    blockedUsers,
    searchResults,
    isLoadingFriends,
    isLoadingRequests,
    isLoadingBlocks,
    isSearching,
    isSendingRequest,
    loadFriends,
    loadReceivedRequests,
    loadSentRequests,
    loadBlockedUsers,
    searchUsers,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    clearSearchResults,
  } = useFriendStore();

  const createDirect = useChatStore((s) => s.createDirect);

  useEffect(() => {
    loadFriends();
    loadReceivedRequests();
    loadSentRequests();
    loadBlockedUsers();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length >= 2) {
      searchUsers(query);
    } else {
      clearSearchResults();
    }
  };

  const handleSendRequest = async (userId: string) => {
    await sendFriendRequest(userId);
  };

  const handleMessageFriend = async (friendId: string) => {
    const convId = await createDirect(friendId);
    if (convId) {
      // Chuyển về tab messages (ChatLayout sẽ tự mở conversation)
      toast.success('Đã mở cuộc trò chuyện');
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b p-4">
        <h1 className="mb-4 text-2xl font-bold">Bạn bè</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="friends" className="gap-2">
              <UserCheck className="size-4" />
              Bạn bè
              <Badge variant="secondary" className="ml-1">
                {friends.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="received" className="gap-2">
              <UserPlus className="size-4" />
              Lời mời
              {receivedRequests.length > 0 && (
                <Badge variant="default" className="ml-1">
                  {receivedRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <Clock className="size-4" />
              Đã gửi
              {sentRequests.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {sentRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="add" className="gap-2">
              <Search className="size-4" />
              Thêm bạn
            </TabsTrigger>
            <TabsTrigger value="blocked" className="gap-2">
              <Ban className="size-4" />
              Đã chặn
              {blockedUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {blockedUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* Tab 1: Friends List */}
          {/* ============================================================ */}
          <TabsContent value="friends" className="mt-4">
            {isLoadingFriends ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : friends.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="mx-auto mb-2 size-12 opacity-50" />}
                title="Chưa có bạn bè nào"
                description="Hãy thêm bạn để bắt đầu trò chuyện!"
              />
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2">
                  {friends.map((friendship) => (
                    <FriendCard
                      key={friendship.friendshipId}
                      user={friendship.friend}
                      friendshipId={friendship.friendshipId}
                      onRemove={() => removeFriend(friendship.friendshipId)}
                      onBlock={() => blockUser(friendship.friend.id)}
                      onMessage={() => handleMessageFriend(friendship.friend.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* Tab 2: Received Requests */}
          {/* ============================================================ */}
          <TabsContent value="received" className="mt-4">
            {isLoadingRequests ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : receivedRequests.length === 0 ? (
              <EmptyState
                icon={<UserPlus className="mx-auto mb-2 size-12 opacity-50" />}
                title="Không có lời mời nào"
              />
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2">
                  {receivedRequests.map((request) => (
                    <FriendRequestCard
                      key={request.friendshipId}
                      request={request}
                      onAccept={() => acceptFriendRequest(request.friendshipId)}
                      onReject={() => rejectFriendRequest(request.friendshipId)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ============================================================ */}
          {/* Tab 3: Sent Requests */}
          {/* ============================================================ */}
          <TabsContent value="sent" className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {sentRequests.length === 0 ? (
                <EmptyState
                  icon={<Clock className="mx-auto mb-2 size-12 opacity-50" />}
                  title="Chưa gửi lời mời nào"
                />
              ) : (
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <SentRequestCard
                      key={request.friendshipId}
                      request={request}
                      onCancel={() => cancelFriendRequest(request.friendshipId)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ============================================================ */}
          {/* Tab 4: Add Friend (Search) */}
          {/* ============================================================ */}
          <TabsContent value="add" className="mt-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm kiếm theo username hoặc tên..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {isSearching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <EmptyState
                  icon={<Search className="mx-auto mb-2 size-12 opacity-50" />}
                  title={searchQuery ? 'Không tìm thấy kết quả' : 'Nhập để tìm kiếm bạn bè'}
                />
              ) : (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2">
                    {searchResults.map((user) => (
                      <SearchResultCard
                        key={user.id}
                        user={user}
                        onSendRequest={() => handleSendRequest(user.id)}
                        isSending={isSendingRequest}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          {/* ============================================================ */}
          {/* Tab 5: Blocked Users */}
          {/* ============================================================ */}
          <TabsContent value="blocked" className="mt-4">
            {isLoadingBlocks ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <EmptyState
                icon={<Ban className="mx-auto mb-2 size-12 opacity-50" />}
                title="Chưa chặn ai"
              />
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2">
                  {blockedUsers.map((block) => (
                    <BlockedUserCard
                      key={block.blockedId}
                      block={block}
                      onUnblock={() => unblockUser(block.blockedId)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      {icon}
      <p>{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  );
}

// ============================================================================
// Presence Badge
// ============================================================================

function PresenceBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ONLINE: 'bg-green-500',
    AWAY: 'bg-yellow-500',
    BUSY: 'bg-red-500',
    DND: 'bg-red-500',
    OFFLINE: 'bg-gray-400',
  };

  return (
    <span
      className={`size-2 rounded-full ${colors[status] || colors.OFFLINE}`}
      title={status}
    />
  );
}

// ============================================================================
// Friend Card (Tab: Bạn bè)
// ============================================================================

function FriendCard({
  user,
  onRemove,
  onBlock,
  onMessage,
}: {
  user: FriendUser;
  friendshipId: string;
  onRemove: () => void;
  onBlock: () => void;
  onMessage: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Avatar className="size-10">
        <AvatarImage src={user.avatarUrl || undefined} />
        <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {user.displayName || user.username}
          </span>
          <PresenceBadge status={user.presenceStatus} />
        </div>
        <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
      </div>

      {showActions && (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onMessage}
            title="Nhắn tin"
          >
            <MessageSquare className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:text-destructive"
            onClick={onRemove}
            title="Hủy kết bạn"
          >
            <UserX className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={onBlock}
            title="Chặn"
          >
            <Ban className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Friend Request Card (Tab: Lời mời)
// ============================================================================

function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: {
  request: FriendRequest;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
      <Avatar className="size-10">
        <AvatarImage src={request.avatarUrl || undefined} />
        <AvatarFallback>{request.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {request.displayName || request.username}
        </div>
        <p className="truncate text-sm text-muted-foreground">@{request.username}</p>
        {request.message && (
          <p className="mt-1 truncate text-xs italic text-muted-foreground">
            "{request.message}"
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onAccept}>
          <Check className="mr-1 size-4" />
          Chấp nhận
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <X className="mr-1 size-4" />
          Từ chối
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Sent Request Card (Tab: Đã gửi)
// ============================================================================

function SentRequestCard({
  request,
  onCancel,
}: {
  request: FriendRequest;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3">
      <Avatar className="size-10">
        <AvatarImage src={request.avatarUrl || undefined} />
        <AvatarFallback>{request.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {request.displayName || request.username}
        </div>
        <p className="truncate text-sm text-muted-foreground">@{request.username}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Đã gửi {new Date(request.createdAt).toLocaleDateString('vi-VN')}
        </p>
      </div>

      <Button size="sm" variant="outline" onClick={onCancel}>
        <X className="mr-1 size-4" />
        Hủy
      </Button>
    </div>
  );
}

// ============================================================================
// Search Result Card (Tab: Thêm bạn)
// ============================================================================

function SearchResultCard({
  user,
  onSendRequest,
  isSending,
}: {
  user: FriendUser;
  onSendRequest: () => void;
  isSending: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50">
      <Avatar className="size-10">
        <AvatarImage src={user.avatarUrl || undefined} />
        <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {user.displayName || user.username}
          </span>
          <PresenceBadge status={user.presenceStatus} />
        </div>
        <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
      </div>

      <Button size="sm" onClick={onSendRequest} disabled={isSending}>
        <UserPlus className="mr-1 size-4" />
        Thêm bạn
      </Button>
    </div>
  );
}

// ============================================================================
// Blocked User Card (Tab: Đã chặn)
// ============================================================================

function BlockedUserCard({
  block,
  onUnblock,
}: {
  block: Block;
  onUnblock: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-destructive/5 p-3">
      <Avatar className="size-10">
        <AvatarImage src={block.avatarUrl || undefined} />
        <AvatarFallback>{block.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {block.displayName || block.username}
        </div>
        <p className="truncate text-sm text-muted-foreground">@{block.username}</p>
        {block.reason && (
          <p className="mt-1 text-xs text-muted-foreground">
            Lý do: {block.reason}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Đã chặn {new Date(block.blockedAt).toLocaleDateString('vi-VN')}
        </p>
      </div>

      <Button size="sm" variant="outline" onClick={onUnblock}>
        Bỏ chặn
      </Button>
    </div>
  );
}