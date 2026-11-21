import { useEffect, useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGroupStore } from '@/stores/groupStore';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { AddMembersDialog } from './AddMembersDialog';
import { toast } from 'sonner';
import {
  Ban, Copy, Crown, Loader2, LogOut, MoreHorizontal,
  Pencil, Trash2, UserPlus, UserX, Users, X,
} from 'lucide-react';

interface Props {
  conversationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GroupInfoSheet({ conversationId, open, onOpenChange }: Props) {
  const me = useAuthStore((s) => s.user);
  const {
    currentGroup: group,
    isLoadingGroup,
    loadGroupByConversation,
    clearCurrentGroup,
    updateGroup,
    deleteGroup,
    leaveGroup,
    kickMember,
    banMember,
    createInvite,
  } = useGroupStore();
  const { closeConversation } = useChatStore();

  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (open) {
      loadGroupByConversation(conversationId);
    } else {
      clearCurrentGroup();
    }
  }, [open, conversationId, loadGroupByConversation, clearCurrentGroup]);

  const members = group?.members ?? [];
  const roles = group?.roles ?? [];

  // ===== Phân quyền (đồng bộ logic với backend) =====
  const isOwner = !!group && !!me && group.ownerId === me.id;
  const myMembership = me ? members.find((m) => m.userId === me.id) : undefined;
  const myRole = myMembership?.roleId
    ? roles.find((r) => r.id === myMembership.roleId)
    : undefined;
  const myPermissions = myRole?.permissions ?? [];

  const canManage = isOwner || myPermissions.includes('KICK_MEMBERS');
  const canInvite = isOwner || myPermissions.includes('INVITE_MEMBERS');
  const canEdit = isOwner || myPermissions.includes('MANAGE_GROUP');

  /** Kiểm tra có thể tác động (kick/ban) lên user khác không — dựa trên hierarchy */
  const canActOn = (targetUserId: string): boolean => {
    if (!me || !group || targetUserId === me.id) return false;
    if (targetUserId === group.ownerId) return false; // Không ai tác động được owner
    if (isOwner) return true;
    const target = members.find((m) => m.userId === targetUserId);
    const targetRole = target?.roleId
      ? roles.find((r) => r.id === target.roleId)
      : undefined;
    return (myRole?.position ?? 40) > (targetRole?.position ?? 40);
  };

  // ===== Actions =====
  const handleInvite = async () => {
    if (!group) return;
    const code = await createInvite(group.id);
    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        toast.success('Đã copy mã mời', { description: `Mã: ${code}` });
      } catch {
        toast.info(`Mã mời: ${code}`);
      }
    }
  };

  const startEdit = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDesc(group.description ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!group || !editName.trim()) return;
    const ok = await updateGroup(group.id, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
    if (ok) setEditing(false);
  };

  const handleKick = async (userId: string) => {
    if (!group) return;
    const ok = await kickMember(group.id, userId);
    if (ok) await loadGroupByConversation(conversationId);
  };

  const handleBan = async (userId: string) => {
    if (!group) return;
    const ok = await banMember(group.id, userId);
    if (ok) await loadGroupByConversation(conversationId);
  };

  const handleLeave = async () => {
    if (!group) return;
    if (!window.confirm('Bạn có chắc muốn rời nhóm này?')) return;
    const ok = await leaveGroup(group.id);
    if (ok) {
      onOpenChange(false);
      closeConversation();
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    if (!window.confirm('Xóa nhóm? Toàn bộ tin nhắn và thành viên sẽ bị ảnh hưởng. Hành động này KHÔNG thể hoàn tác!')) return;
    const ok = await deleteGroup(group.id);
    if (ok) {
      onOpenChange(false);
      closeConversation();
    }
  };

  const memberName = (m: (typeof members)[number]) =>
    m.displayName || m.username;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Thông tin nhóm
          </SheetTitle>
        </SheetHeader>

        {isLoadingGroup || !group ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* ===== Thông tin cơ bản ===== */}
            <div className="flex items-start gap-4">
              <Avatar className="size-16">
                <AvatarImage src={group.avatarUrl || undefined} />
                <AvatarFallback className="text-xl">
                  {group.name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                {editing ? (
                  <div className="space-y-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                    />
                    <Textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Mô tả nhóm..."
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}>Lưu</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-lg font-semibold">{group.name}</h3>
                      {canEdit && (
                        <Button size="icon-xs" variant="ghost" onClick={startEdit}>
                          <Pencil className="size-3" />
                        </Button>
                      )}
                    </div>
                    {group.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {group.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group.memberCount ?? members.length} thành viên
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ===== Actions nhanh ===== */}
            <div className="flex flex-wrap gap-2">
              {canInvite && (
                <Button size="sm" variant="outline" onClick={handleInvite}>
                  <Copy className="mr-1 size-4" />
                  Copy mã mời
                </Button>
              )}
              {canInvite && (
                <Button size="sm" variant="outline" onClick={() => setAddMembersOpen(true)}>
                  <UserPlus className="mr-1 size-4" />
                  Thêm thành viên
                </Button>
              )}
            </div>

            <Separator />

            {/* ===== Danh sách thành viên ===== */}
            <div className="flex-1">
              <h4 className="mb-2 text-sm font-medium">
                Thành viên ({members.length})
              </h4>
              <ScrollArea className="max-h-80">
                <div className="space-y-1">
                  {members.map((m) => (
                    <div
                      key={m.userId}
                      className="group flex items-center gap-3 rounded-md p-2 hover:bg-muted/50"
                    >
                      <Avatar className="size-9">
                        <AvatarImage src={m.avatarUrl || undefined} />
                        <AvatarFallback>
                          {m.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {memberName(m)}
                          </span>
                          {m.userId === me?.id && (
                            <span className="text-xs text-muted-foreground">(bạn)</span>
                          )}
                          {m.userId === group.ownerId && (
                            <Crown className="size-3.5 shrink-0 text-yellow-500" />
                          )}
                        </div>
                        {m.roleName && m.userId !== group.ownerId && (
                          <Badge
                            variant="secondary"
                            className="mt-0.5 text-[10px]"
                            style={m.roleColor ? { color: m.roleColor } : undefined}
                          >
                            {m.roleName}
                          </Badge>
                        )}
                      </div>

                      {/* Actions lên thành viên khác (nếu có quyền) */}
                      {canManage && canActOn(m.userId) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleKick(m.userId)}
                            >
                              <UserX className="size-4" />
                              Kick khỏi nhóm
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleBan(m.userId)}
                            >
                              <Ban className="size-4" />
                              Ban khỏi nhóm
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Separator />

            {/* ===== Actions nguy hiểm ===== */}
            <div className="space-y-2">
              {!isOwner && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleLeave}
                >
                  <LogOut className="mr-2 size-4" />
                  Rời nhóm
                </Button>
              )}
              {isOwner && (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-2 size-4" />
                  Xóa nhóm (Owner)
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Dialog thêm thành viên (con) */}
        {group && (
          <AddMembersDialog
            groupId={group.id}
            conversationId={conversationId}
            existingMemberIds={members.map((m) => m.userId)}
            open={addMembersOpen}
            onOpenChange={setAddMembersOpen}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}