import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage,  } from '@/components/ui/avatar';
import { useCallStore } from '@/stores/callStore';
import { Phone, PhoneOff, Video,  } from 'lucide-react';

export function IncomingCallModal() {
  const { status, callId, callType,acceptCall, rejectCall } = useCallStore();
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (status !== 'INCOMING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          rejectCall(callId!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, callId]);

  if (status !== 'INCOMING' || !callId) return null;

  // Lấy thông tin caller từ store hoặc API
  // Tạm thời hiển thị placeholder
  const callerName = 'Người gọi';
  const callerAvatar = null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-6">
          {/* Avatar */}
          <Avatar className="size-24 ring-4 ring-primary/20">
  <AvatarImage src={callerAvatar || undefined} />
  <AvatarFallback className="text-3xl">
    {callerName[0]?.toUpperCase()}
  </AvatarFallback>
</Avatar>

          {/* Info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold">{callerName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {callType === 'VIDEO' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'} đến
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Từ chối sau {timeLeft}s
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              variant="destructive"
              size="lg"
              className="size-16 rounded-full"
              onClick={() => rejectCall(callId)}
            >
              <PhoneOff className="size-6" />
            </Button>

            <Button
              variant="default"
              size="lg"
              className="size-16 rounded-full bg-green-600 hover:bg-green-700"
              onClick={() => acceptCall(callId)}
            >
              {callType === 'VIDEO' ? (
                <Video className="size-6" />
              ) : (
                <Phone className="size-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
