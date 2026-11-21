import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, SendHorizonal, X } from 'lucide-react';

interface Props {
  disabled?: boolean;
  onSend: (text: string) => void;
  onSendFiles: (files: File[]) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

export function ChatInput({ disabled, onSend, onSendFiles, onTypingStart, onTypingStop }: Props) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTyping = () => {
    if (!typingRef.current) {
      typingRef.current = true;
      onTypingStart();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      typingRef.current = false;
      onTypingStop();
    }, 2000);
  };

  const submit = () => {
    if (files.length) {
      onSendFiles(files);
      setFiles([]);
    }
    if (text.trim()) {
      onSend(text);
      setText('');
    }
    typingRef.current = false;
    onTypingStop();
  };

  return (
    <div className="border-t p-3">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
              {f.name}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            setFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <Button variant="ghost" size="icon" onClick={() => fileRef.current?.click()} disabled={disabled}>
          <Paperclip />
        </Button>

        <Textarea
          value={text}
          disabled={disabled}
          placeholder="Nhập tin nhắn..."
          className="max-h-32 min-h-9 flex-1 resize-none"
          onChange={(e) => { setText(e.target.value); handleTyping(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />

        <Button size="icon" onClick={submit} disabled={disabled || (!text.trim() && !files.length)}>
          <SendHorizonal />
        </Button>
      </div>
    </div>
  );
}