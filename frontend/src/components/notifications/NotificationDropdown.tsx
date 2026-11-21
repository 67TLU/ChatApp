import { useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useNotificationStore } from '@/stores/notificationStore';
import { CheckCheck, X } from 'lucide-react';
import type { Notification } from '@/services/api/notifications';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
interface Props {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: Props) {
  const {
    notifications,
    unreadCount,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();
const navigate = useNavigate()
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'FRIEND_REQUEST':
        return '👋';
      case 'FRIEND_ACCEPTED':
        return '🎉';
      case 'MENTION':
        return '💬';
      case 'CALL_MISSED':
        return '📞';
      case 'GROUP_INVITE':
        return '👥';
      default:
        return '🔔';
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-popover border rounded-lg shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Thông báo</h3>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead()}
            className="text-xs"
          >
            <CheckCheck className="size-4 mr-1" />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="max-h-[500px]">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            Đang tải...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Không có thông báo nào
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                  !notification.isRead ? 'bg-primary/5' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <Avatar className="size-10 shrink-0">
                  <AvatarImage src={notification.actorAvatarUrl || undefined} />
                  <AvatarFallback>
                    {notification.actorDisplayName?.[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {getIcon(notification.type)} {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>

                    {!notification.isRead && (
                      <span className="size-2 bg-primary rounded-full shrink-0 mt-2" />
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}