import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFriendStore } from '@/stores/friendStore';
import { useGroupStore } from '@/stores/groupStore';
import { Loader2, Search, UserPlus } from 'lucide-react';

interface Props {
  groupId: string;
  conversationId: string;
  existingMemberIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMembersDialog({
  groupId,
  conversationId,
  existingMemberIds,
  open,
  onOpenChange,
}: Props) {
  const { friends, isLoadingFriends, loadFriends } = useFriendStore();
  const { addMember, loadGroupByConversation } = useGroupStore();

  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) {
      loadFriends();
      setSelected([]);
      setQ('');
    }
  }, [open, loadFriends]);

  // Bạn bè chưa phải thành viên nhóm
  const candidates = useMemo(() => {
    const keyword = q.toLowerCase();
    return friends.filter((f) => {
      if (existingMemberIds.includes(f.friend.id)) return false;
      return (
        f.friend.username.toLowerCase().includes(keyword) ||
        (f.friend.displayName ?? '').toLowerCase().includes(keyword)
      );
    });
  }, [friends, existingMemberIds, q]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (selected.length === 0 || adding) return;
    setAdding(true);

    let successCount = 0;
    for (const userId of selected) {
      const ok = await addMember(groupId, userId);
      if (ok) successCount++;
    }

    setAdding(false);

    if (successCount > 0) {
      await loadGroupByConversation(conversationId);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            Thêm thành viên
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm bạn bè..."
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-64 rounded-md border">
          {isLoadingFriends ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có bạn bè nào để thêm (tất cả đã ở trong nhóm hoặc chưa kết bạn)
            </p>
          ) : (
            <div className="p-2">
              {candidates.map((f) => (
                <div
                  key={f.friendshipId}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                  onClick={() => toggle(f.friend.id)}
                >
                  <Checkbox
                    checked={selected.includes(f.friend.id)}
                    onCheckedChange={() => toggle(f.friend.id)}
                  />
                  <Avatar className="size-8">
                    <AvatarImage src={f.friend.avatarUrl || undefined} />
                    <AvatarFallback>
                      {f.friend.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {f.friend.displayName || f.friend.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{f.friend.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={selected.length === 0 || adding}>
            {adding && <Loader2 className="mr-2 size-4 animate-spin" />}
            Thêm ({selected.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}