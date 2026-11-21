import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { friendsApi } from '@/services/api/friends'; // ⭐ Đổi import
import { useChatStore } from '@/stores/chatStore';
import type { SearchUser } from '@/types/chat';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewChatDialog({ open, onOpenChange }: Props) { // ⭐ Nhận props
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const createDirect = useChatStore((s) => s.createDirect);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        // ⭐ Đổi API call
        const res = await friendsApi.searchUsers(q.trim());
        setResults(res.data.data);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const start = async (userId: string) => {
    const id = await createDirect(userId);
    if (id) {
      onOpenChange(false); // ⭐ Đóng dialog
      setQ('');
      setResults([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tin nhắn mới</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Tìm theo username hoặc tên..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="size-5 animate-spin" />
            </div>
          )}
          {!loading && q.length >= 2 && results.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Không tìm thấy</p>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              onClick={() => start(u.id)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted"
            >
              <Avatar className="size-9">
                <AvatarImage src={u.avatarUrl ?? undefined} />
                <AvatarFallback>{u.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.displayName || u.username}</p>
                <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}