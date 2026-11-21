import { Server } from 'socket.io';
import { CALL_CONFIG } from '@/config/call.config';

type TimerKey = string; // `${callId}` hoặc `${callId}:${userId}`

class CallLifecycleManager {
  private io: Server | null = null;

  private ringingTimers = new Map<TimerKey, NodeJS.Timeout>();
  private reconnectTimers = new Map<TimerKey, NodeJS.Timeout>();
  private sweepTimer: NodeJS.Timeout | null = null;

  init(io: Server) {
    this.io = io;
  }

  getIO(): Server {
    if (!this.io) throw new Error('CallLifecycleManager chưa được init với Socket.IO');
    return this.io;
  }

  // ===== RINGING =====

  startRinging(callId: string, onTimeout: () => void | Promise<void>) {
    this.clearRinging(callId);
    const timer = setTimeout(async () => {
      this.ringingTimers.delete(callId);
      await onTimeout();
    }, CALL_CONFIG.RINGING_TIMEOUT_MS);
    this.ringingTimers.set(callId, timer);
  }

  clearRinging(callId: string) {
    const t = this.ringingTimers.get(callId);
    if (t) clearTimeout(t);
    this.ringingTimers.delete(callId);
  }

  // ===== RECONNECT GRACE =====

  reconnectKey(callId: string, userId: string) {
    return `${callId}:${userId}`;
  }

  startReconnectGrace(callId: string, userId: string, onExpire: () => void | Promise<void>) {
    const key = this.reconnectKey(callId, userId);
    this.clearReconnectGrace(callId, userId);

    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(key);
      await onExpire();
    }, CALL_CONFIG.RECONNECT_GRACE_MS);

    this.reconnectTimers.set(key, timer);
  }

  clearReconnectGrace(callId: string, userId: string) {
    const key = this.reconnectKey(callId, userId);
    const t = this.reconnectTimers.get(key);
    if (t) clearTimeout(t);
    this.reconnectTimers.delete(key);
  }

  hasReconnectGrace(callId: string, userId: string) {
    return this.reconnectTimers.has(this.reconnectKey(callId, userId));
  }

  // ===== CLEANUP =====

  clearAllForCall(callId: string) {
    this.clearRinging(callId);
    for (const key of Array.from(this.reconnectTimers.keys())) {
      if (key.startsWith(`${callId}:`)) {
        clearTimeout(this.reconnectTimers.get(key)!);
        this.reconnectTimers.delete(key);
      }
    }
  }

  clearAllForUser(userId: string) {
    for (const key of Array.from(this.reconnectTimers.keys())) {
      if (key.endsWith(`:${userId}`)) {
        clearTimeout(this.reconnectTimers.get(key)!);
        this.reconnectTimers.delete(key);
      }
    }
  }

  // ===== STALE SWEEP =====

  startSweep(onSweep: () => Promise<void>) {
    if (this.sweepTimer) return;
    this.sweepTimer = setInterval(() => {
      onSweep().catch(err => console.error('[call-sweep]', err));
    }, CALL_CONFIG.STALE_CALL_SWEEP_INTERVAL_MS);
  }

  shutdown() {
    for (const t of this.ringingTimers.values()) clearTimeout(t);
    for (const t of this.reconnectTimers.values()) clearTimeout(t);
    this.ringingTimers.clear();
    this.reconnectTimers.clear();
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }
}

export const callLifecycle = new CallLifecycleManager();