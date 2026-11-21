import dotenv from 'dotenv';
dotenv.config();

// ICE Servers configuration
export const ICE_SERVERS: RTCIceServer[] = [
  // Public STUN servers (free, cho dev)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Nếu có TURN server (production)
if (process.env.TURN_SERVER_URL) {
  ICE_SERVERS.push({
    urls: process.env.TURN_SERVER_URL,
    username: process.env.TURN_SERVER_USERNAME,
    credential: process.env.TURN_SERVER_CREDENTIAL,
  });
}

// RTCPeerConnection config
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10,
};