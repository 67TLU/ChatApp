import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallStore } from '@/stores/callStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import {
  Mic, MicOff, Video, VideoOff, Phone, Monitor, MonitorOff,
} from 'lucide-react';

export function CallRoom() {
  useWebRTC();
  
  const {
    status, callType, localStream, remoteStream, screenShareStream,
    isMuted, isVideoOn, isScreenSharing, startTime, duration,
    endCall, toggleMute, toggleVideo, toggleScreenShare,
  } = useCallStore();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [callDuration, setCallDuration] = useState(0);

  // Attach streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenShareStream) {
      screenVideoRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream]);

  // Update duration
  useEffect(() => {
    if (status !== 'CONNECTED' || !startTime) return;

    const timer = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [status, startTime]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'IDLE') return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between bg-black/50 p-4 text-white">
        <div>
          <h2 className="text-lg font-semibold">
            {callType === 'VIDEO' ? 'Cuộc gọi video' : 'Cuộc gọi thoại'}
          </h2>
          {status === 'CONNECTED' && (
            <p className="text-sm text-muted-foreground">
              {formatDuration(callDuration)}
            </p>
          )}
          {status === 'OUTGOING' && (
            <p className="text-sm text-muted-foreground">Đang gọi...</p>
          )}
          {status === 'ACCEPTED' && (
            <p className="text-sm text-muted-foreground">Đang kết nối...</p>
          )}
        </div>
      </div>

      {/* Video Area */}
      <div className="relative flex-1">
        {/* Remote video (full screen) */}
        {callType === 'VIDEO' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="size-full object-cover"
          />
        )}

        {/* Screen share */}
        {isScreenSharing && screenShareStream && (
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 size-full object-contain"
          />
        )}

        {/* Local video (picture-in-picture) */}
        {callType === 'VIDEO' && localStream && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-32 w-24 rounded-lg border-2 border-white/20 object-cover shadow-lg md:h-48 md:w-36"
          />
        )}

        {/* Voice call placeholder */}
        {callType === 'VOICE' && (
          <div className="flex size-full items-center justify-center">
             <audio
    ref={(el) => { if (el) el.srcObject = remoteStream; }}
    autoPlay
  />
            <Avatar className="size-32">
              <AvatarFallback className="text-4xl">U</AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Connecting overlay */}
        {(status === 'OUTGOING' || status === 'ACCEPTED') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="mx-auto mb-4 size-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-lg">
                {status === 'OUTGOING' ? 'Đang gọi...' : 'Đang kết nối...'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 bg-black/50 p-6">
        {/* Mute */}
        <Button
          variant={isMuted ? 'destructive' : 'secondary'}
          size="lg"
          className="size-14 rounded-full"
          onClick={toggleMute}
        >
          {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </Button>

        {/* Video toggle (chỉ hiện khi là video call) */}
        {callType === 'VIDEO' && (
          <Button
            variant={isVideoOn ? 'secondary' : 'destructive'}
            size="lg"
            className="size-14 rounded-full"
            onClick={toggleVideo}
          >
            {isVideoOn ? <Video className="size-6" /> : <VideoOff className="size-6" />}
          </Button>
        )}

        {/* Screen share */}
        <Button
          variant={isScreenSharing ? 'destructive' : 'secondary'}
          size="lg"
          className="size-14 rounded-full"
          onClick={toggleScreenShare}
        >
          {isScreenSharing ? <MonitorOff className="size-6" /> : <Monitor className="size-6" />}
        </Button>

        {/* End call */}
        <Button
          variant="destructive"
          size="lg"
          className="size-14 rounded-full"
          onClick={endCall}
        >
          <Phone className="size-6 rotate-[135deg]" />
        </Button>
      </div>
    </div>
  );
}