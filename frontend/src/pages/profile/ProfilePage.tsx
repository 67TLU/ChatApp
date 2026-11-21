import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserStore } from '@/stores/userStore';
import { useNavigate } from 'react-router-dom';
import { Loader2, Camera, Save } from 'lucide-react';
import { apiClient } from '@/services/api/client';

const profileSchema = z.object({
  displayName: z.string().min(1, 'Tên không được để trống').max(64),
  bio: z.string().max(500).optional(),
  customStatus: z.string().max(100).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  newPassword: z.string().min(6, 'Mật khẩu mới ít nhất 6 ký tự'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const navigate = useNavigate();
  const {
    profile, settings,
    isLoadingProfile, isLoadingSettings,
    loadProfile, loadSettings,
    updateProfile, updateAvatar, updateCover,
    changePassword, updateSettings,
  } = useUserStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadProfile();
    loadSettings();
  }, []);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      displayName: profile.displayName || '',
      bio: profile.bio || '',
      customStatus: profile.customStatus || '',
    } : undefined,
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsSavingProfile(true);
    await updateProfile(data);
    setIsSavingProfile(false);
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    const success = await changePassword(data.currentPassword, data.newPassword);
    if (success) {
      passwordForm.reset();
    }
    setIsChangingPassword(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // TODO: Upload file và lấy URL
    // Tạm thời dùng placeholder
 const formData = new FormData();
 formData.append('avatar', file);
 const res = await apiClient.post('/users/me/avatar/upload', formData);
 await updateAvatar(res.data.data.url);
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    await updateCover(url);
  };

  if (isLoadingProfile || !profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold">Hồ sơ cá nhân</h1>
        <p className="text-sm text-muted-foreground">Quản lý thông tin và cài đặt tài khoản</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
            <TabsTrigger value="account">Tài khoản</TabsTrigger>
            <TabsTrigger value="settings">Cài đặt</TabsTrigger>
          </TabsList>

          {/* Tab: Profile */}
          <TabsContent value="profile" className="mt-6 space-y-6">
            {/* Cover & Avatar */}
            <Card>
              <CardContent className="pt-6">
                <div className="relative">
                  {/* Cover */}
                  <div className="relative h-48 overflow-hidden rounded-lg bg-muted">
                    {profile.coverUrl && (
                      <img src={profile.coverUrl} alt="Cover" className="size-full object-cover" />
                    )}
                    <label className="absolute bottom-2 right-2 cursor-pointer">
                      <input type="file" accept="image/*" hidden onChange={handleCoverChange} />
                      <Button size="sm" variant="secondary" className="gap-2">
                        <Camera className="size-4" />
                        Đổi ảnh bìa
                      </Button>
                    </label>
                  </div>

                  {/* Avatar */}
                  <div className="absolute -bottom-12 left-6">
                    <Avatar className="size-24 ring-4 ring-background">
                      <AvatarImage src={profile.avatarUrl || undefined} />
                      <AvatarFallback className="text-2xl">
                        {profile.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute bottom-0 right-0 cursor-pointer">
                      <input type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                      <Button size="icon" variant="secondary" className="size-8">
                        <Camera className="size-4" />
                      </Button>
                    </label>
                  </div>
                </div>

                <div className="mt-16">
                  <h2 className="text-xl font-semibold">
                    {profile.displayName || profile.username}
                  </h2>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>
              </CardContent>
            </Card>

            {/* Profile Form */}
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Tên hiển thị</Label>
                    <Input
                      id="displayName"
                      {...profileForm.register('displayName')}
                      placeholder="Nhập tên hiển thị"
                    />
                    {profileForm.formState.errors.displayName && (
                      <p className="text-sm text-red-500">
                        {profileForm.formState.errors.displayName.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Giới thiệu</Label>
                    <Textarea
                      id="bio"
                      {...profileForm.register('bio')}
                      placeholder="Hãy giới thiệu về bản thân..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customStatus">Trạng thái tùy chỉnh</Label>
                    <Input
                      id="customStatus"
                      {...profileForm.register('customStatus')}
                      placeholder="VD: Đang nghe nhạc 🎵"
                    />
                  </div>

                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 size-4" />
                        Lưu thay đổi
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Account */}
          <TabsContent value="account" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Đổi mật khẩu</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      {...passwordForm.register('currentPassword')}
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Mật khẩu mới</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      {...passwordForm.register('newPassword')}
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      {...passwordForm.register('confirmPassword')}
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-red-500">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Đang xử lý...
                      </>
                    ) : (
                      'Đổi mật khẩu'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Settings */}
          <TabsContent value="settings" className="mt-6">
            {isLoadingSettings || !settings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Cài đặt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Presence */}
                  <div className="space-y-3">
                    <Label>Trạng thái mặc định khi online</Label>
                    <Select
                      value={settings.defaultPresence}
                      onValueChange={(value) => updateSettings({ defaultPresence: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ONLINE">Online</SelectItem>
                        <SelectItem value="AWAY">Away</SelectItem>
                        <SelectItem value="BUSY">Busy</SelectItem>
                        <SelectItem value="DND">Do Not Disturb</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Privacy */}
                  <div className="space-y-3">
                    <Label>Hiển thị "đã xem" cho</Label>
                    <Select
                      value={settings.showLastSeen}
                      onValueChange={(value) => updateSettings({ showLastSeen: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVERYONE">Mọi người</SelectItem>
                        <SelectItem value="FRIENDS">Chỉ bạn bè</SelectItem>
                        <SelectItem value="NOBODY">Không ai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notifications */}
                  <div className="space-y-3">
                    <Label>Thông báo</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Lời mời kết bạn</span>
                        <Select
                          value={settings.notifyFriendRequest}
                          onValueChange={(value) => updateSettings({ notifyFriendRequest: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENABLED">Bật</SelectItem>
                            <SelectItem value="DISABLED">Tắt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tin nhắn</span>
                        <Select
                          value={settings.notifyMessage}
                          onValueChange={(value) => updateSettings({ notifyMessage: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENABLED">Bật</SelectItem>
                            <SelectItem value="DISABLED">Tắt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">Cuộc gọi</span>
                        <Select
                          value={settings.notifyCall}
                          onValueChange={(value) => updateSettings({ notifyCall: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENABLED">Bật</SelectItem>
                            <SelectItem value="DISABLED">Tắt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}