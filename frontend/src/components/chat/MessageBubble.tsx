import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatTime } from '@/lib/utils';
import { config } from '@/config/env';
import type { Message } from '@/types/chat';
import { Pencil, Trash2, Check, X, Smile } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const fileBase = config.apiUrl.replace(/\/api$/, '');

interface Props {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onReact: (emoji: string) => void;
  currentUserId: string;
}

export function MessageBubble({
  message, isMine, showAvatar, onEdit, onDelete, onReact, currentUserId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? '');
  const [showEmoji, setShowEmoji] = useState(false);

  const deleted = message.status === 'DELETED';
  const name = message.sender?.displayName || message.sender?.username || 'Người dùng';

  const submitEdit = () => {
    const text = draft.trim();
    if (text && text !== message.content) onEdit(text);
    setEditing(false);
  };

  return (
    <div className={cn('group flex gap-2 px-4 py-1', isMine && 'flex-row-reverse')}>
      <div className="w-8 shrink-0">
        {showAvatar && !isMine && (
          <Avatar className="size-8">
            <AvatarImage src={message.sender?.avatarUrl ?? undefined} />
            <AvatarFallback>{name[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
        )}
      </div>

      <div className={cn('flex max-w-[70%] flex-col gap-1', isMine && 'items-end')}>
        {showAvatar && !isMine && (
          <span className="text-xs text-muted-foreground">{name}</span>
        )}

        <div className={cn('relative rounded-2xl px-3 py-2 text-sm',
          isMine ? 'bg-primary text-primary-foreground' : 'bg-muted',
          deleted && 'italic opacity-60'
        )}>
          {deleted ? (
            <span>Tin nhắn đã bị xóa</span>
          ) : editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="h-7 min-w-52 bg-background text-foreground"
              />
              <Button size="icon-xs" variant="ghost" onClick={submitEdit}><Check /></Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setEditing(false)}><X /></Button>
            </div>
          ) : (
            <>
              {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

              {message.attachments?.map((a) => (
                <div key={a.id} className="mt-1">
                  {a.fileType === 'IMAGE' ? (
                    <img
                      src={`${fileBase}${a.url}`}
                      alt={a.fileName}
                      className="max-h-64 rounded-lg object-cover"
                    />
                  ) : (
                    <a
                      href={`${fileBase}${a.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      📎 {a.fileName}
                    </a>
                  )}
                </div>
              ))}
            </>
          )}

          {!deleted && !editing && (
            <div className={cn(
              'absolute top-0 hidden gap-0.5 group-hover:flex',
              isMine ? 'right-full mr-1' : 'left-full ml-1'
            )}>
              <Button size="icon-xs" variant="ghost" onClick={() => setShowEmoji((v) => !v)}>
                <Smile />
              </Button>
              {isMine && message.messageType === 'TEXT' && (
                <Button size="icon-xs" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil />
                </Button>
              )}
              {isMine && (
                <Button size="icon-xs" variant="ghost" onClick={onDelete}>
                  <Trash2 />
                </Button>
              )}
            </div>
          )}

          {showEmoji && (
            <div className={cn(
              'absolute z-10 flex gap-1 rounded-full bg-popover p-1 shadow ring-1 ring-foreground/10',
              isMine ? 'right-0 top-full' : 'left-0 top-full'
            )}>
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  className="rounded px-1 hover:bg-muted"
                  onClick={() => { onReact(e); setShowEmoji(false); }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {message.reactions?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.reactions.map((r) => {
              const mine = r.users.some((u) => u.userId === currentUserId);
              return (
                <button
                  key={r.emoji}
                  onClick={() => onReact(r.emoji)}
                  className={cn(
                    'rounded-full border px-1.5 text-xs',
                    mine ? 'border-primary bg-primary/10' : 'border-border'
                  )}
                >
                  {r.emoji} {r.count}
                </button>
              );
            })}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
          {message.status === 'SENDING' && ' · đang gửi'}
          {message.status === 'FAILED' && ' · lỗi'}
          {message.status === 'EDITED' && ' · đã sửa'}
        </span>
      </div>
    </div>
  );
}