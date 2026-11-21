export type CallType = 'VOICE' | 'VIDEO';
export type CallStatus = 
  | 'IDLE'
  | 'OUTGOING'
  | 'INCOMING'
  | 'ACCEPTED'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'ENDED';

export interface CallParticipant {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  status: string;
}

export interface CallState {
  callId: string | null;
  conversationId: string | null;
  callType: CallType;
  status: CallStatus;
  initiatorId: string | null;
  targetUserId: string | null;
  participants: CallParticipant[];
  startTime: number | null;
  duration: number;
  
  // Media state
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  screenShareStream: MediaStream | null;
  
  // Device state
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
}

export interface IncomingCallData {
  callId: string;
  conversationId: string;
  callType: CallType;
  caller: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  ringingTimeoutMs: number;
}