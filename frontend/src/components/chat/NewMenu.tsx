import { useState } from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { NewChatDialog } from './NewChatDialog';
import { CreateGroupDialog } from '@/components/groups/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/groups/JoinGroupDialog';
import { KeyRound, MessageSquarePlus, Plus, Users } from 'lucide-react';

export function NewMenu() {
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [joinGroupOpen, setJoinGroupOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost">
            <Plus />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setNewChatOpen(true)}>
            <MessageSquarePlus className="size-4" />
            Tin nhắn mới
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCreateGroupOpen(true)}>
            <Users className="size-4" />
            Tạo nhóm mới
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setJoinGroupOpen(true)}>
            <KeyRound className="size-4" />
            Tham gia nhóm bằng mã
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
      <CreateGroupDialog open={createGroupOpen} onOpenChange={setCreateGroupOpen} />
      <JoinGroupDialog open={joinGroupOpen} onOpenChange={setJoinGroupOpen} />
    </>
  );
}