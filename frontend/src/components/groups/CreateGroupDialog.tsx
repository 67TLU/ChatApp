import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { useFriendStore } from '@/stores/friendStore';
import { useGroupStore } from '@/stores/groupStore';
import { useChatStore } from '@/stores/chatStore';
import { Loader2, Search, Users } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateGroupDialog({ open, onOpenChange }: Props) {
  const { friends, isLoadingFriends, loadFriends } = useFriendStore();
  const createGroup = useGroupStore((s) => s.createGroup);
  const openConversation = useChatStore((s) => s.openConversation);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) loadFriends();
  }, [open, loadFriends]);

  const filtered = useMemo(() => {
    const keyword = q.toLowerCase();
    return friends.filter(
      (f) =>
        f.friend.username.toLowerCase().includes(keyword) ||
        (f.friend.displayName ?? '').toLowerCase().includes(keyword)
    );
  }, [friends, q]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const reset = () => {
    setName('');
    setDescription('');
    setSelected([]);
    setQ('');
  };

  const submit = async () => {
    if (!name.trim() || selected.length === 0 || creating) return;
    setCreating(true);
    const conversationId = await createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      memberIds: selected,
    });
    setCreating(false);
    if (conversationId) {
      onOpenChange(false);
      reset();
      await openConversation(conversationId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Tạo nhóm mới
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tên nhóm *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên nhóm..."
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label>Mô tả (tùy chọn)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhóm này về..."
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Chọn thành viên * ({selected.length} đã chọn)
            </Label>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm bạn bè..."
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-56 rounded-md border">
              {isLoadingFriends ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {friends.length === 0
                    ? 'Bạn chưa có bạn bè nào. Hãy kết bạn trước!'
                    : 'Không tìm thấy bạn bè phù hợp'}
                </p>
              ) : (
                <div className="p-2">
                  {filtered.map((f) => (
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={submit}
            disabled={!name.trim() || selected.length === 0 || creating}
          >
            {creating && <Loader2 className="mr-2 size-4 animate-spin" />}
            Tạo nhóm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}