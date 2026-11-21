import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';
import type { Message } from '@/types/chat';

interface Props {
  messages: Message[];
  currentUserId: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
}

export function MessageList({
  messages, currentUserId, loading, loadingMore, hasMore,
  onLoadMore, onEdit, onDelete, onReact,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef(0);

  useEffect(() => {
    if (!viewportRef.current) return;
    const viewport = viewportRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return;

    if (loadingMore) {
      prevHeightRef.current = viewport.scrollHeight;
    } else if (prevHeightRef.current > 0) {
      // Giữ vị trí đọc
      const newHeight = viewport.scrollHeight;
      viewport.scrollTop += newHeight - prevHeightRef.current;
      prevHeightRef.current = 0;
    } else {
      // Tin nhắn mới → scroll xuống
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, loadingMore]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={viewportRef}>
      <div className="py-4">
        {hasMore && (
          <div className="mb-2 flex justify-center">
            <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="animate-spin" /> : 'Tải tin nhắn cũ hơn'}
            </Button>
          </div>
        )}

        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chưa có tin nhắn. Hãy gửi lời chào 👋
          </p>
        )}

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showAvatar = !prev || prev.senderId !== m.senderId;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              isMine={m.senderId === currentUserId}
              showAvatar={showAvatar}
              currentUserId={currentUserId}
              onEdit={(content) => onEdit(m.id, content)}
              onDelete={() => onDelete(m.id)}
              onReact={(emoji) => onReact(m.id, emoji)}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}