import { useState } from 'react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGroupStore } from '@/stores/groupStore';
import { KeyRound, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Tách mã mời từ chuỗi người dùng dán vào (hỗ trợ cả URL /invite/xxx) */
const extractCode = (input: string): string => {
  const trimmed = input.trim();
  const match = trimmed.match(/invite\/([a-f0-9]{16})/i);
  return match ? match[1] : trimmed;
};

export function JoinGroupDialog({ open, onOpenChange }: Props) {
  const joinByCode = useGroupStore((s) => s.joinByCode);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const submit = async () => {
    const extracted = extractCode(code);
    if (extracted.length !== 16 || joining) return;

    setJoining(true);
    const ok = await joinByCode(extracted);
    setJoining(false);

    if (ok) {
      onOpenChange(false);
      setCode('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            Tham gia nhóm
          </DialogTitle>
          <DialogDescription>
            Nhập mã mời (16 ký tự) hoặc dán link mời bạn nhận được
          </DialogDescription>
        </DialogHeader>

        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Dán mã mời hoặc link..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          autoFocus
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={extractCode(code).length !== 16 || joining}>
            {joining && <Loader2 className="mr-2 size-4 animate-spin" />}
            Tham gia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}