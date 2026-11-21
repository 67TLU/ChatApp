import { useEffect, useRef } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useAuthStore } from '@/stores/authStore';
import { socketService } from '@/services/socket/socket';
import { config } from '@/config/env';

export function useWebRTC() {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidates = useRef<RTCIceCandidate[]>([]);
  const me = useAuthStore((s) => s.user);
  const {
    callId, status, callType, initiatorId, targetUserId,
    localStream, remoteStream, screenShareStream,
  } = useCallStore();

  // Effect 1: tạo peer connection khi ACCEPTED (chỉ phụ thuộc callId)
  useEffect(() => {
    if (status !== 'ACCEPTED' || !callId || !me?.id) return;
    if (peerConnectionRef.current) return; // tránh tạo trùng
    createPeerConnection();
  }, [callId]); // ⭐ chỉ phụ thuộc callId, KHÔNG phụ thuộc status

  // Effect 2: cleanup khi call kết thúc
  useEffect(() => {
    if (status === 'ENDED' || status === 'IDLE') {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    }
  }, [status]);



  const createPeerConnection = async () => {
    const iceServers = await fetchIceServers();

    const pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10,
    });

    peerConnectionRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'VIDEO',
    });

    useCallStore.setState({ localStream: stream });

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.emit('call:signal', {
          callId,
          targetUserId: initiatorId === me?.id ? targetUserId : initiatorId,
          signal: {
            type: 'ice-candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      useCallStore.setState({ remoteStream });
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        useCallStore.setState({ status: 'CONNECTED', startTime: Date.now() });
        socketService.emit('call:webrtc-connected', { callId });
      } else if (pc.connectionState === 'failed') {
        console.error('WebRTC connection failed');
      }
    };

    // Setup signaling listeners
    setupSignalingListeners(pc);
  };

  const setupSignalingListeners = (pc: RTCPeerConnection) => {
    socketService.on('call:signal', async (data: any) => {
      if (data.callId !== callId) return;

      const { signal } = data;

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: signal.sdp,
        }));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketService.emit('call:signal', {
          callId,
          targetUserId: data.fromUserId,
          signal: {
            type: 'answer',
            sdp: answer.sdp,
          },
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription({
          type: 'answer',
          sdp: signal.sdp,
        }));
      } else if (signal.type === 'ice-candidate') {
        const candidate = new RTCIceCandidate(signal.candidate);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          pendingCandidates.current.push(candidate);
        }
      }
    });
  };

  const fetchIceServers = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/calls/ice-servers`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().accessToken}`,
        },
      });
      const data = await response.json();
      return data.data.iceServers;
    } catch (error) {
      console.error('Failed to fetch ICE servers:', error);
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  };
}