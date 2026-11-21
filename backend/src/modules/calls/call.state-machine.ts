import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

export const CALL_STATUS = {
  CREATED: 'CREATED',
  RINGING: 'RINGING',
  ACCEPTED: 'ACCEPTED',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  ENDED: 'ENDED',
  MISSED: 'MISSED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
} as const;

export type CallStatus = typeof CALL_STATUS[keyof typeof CALL_STATUS];

export const TERMINAL_STATUSES: CallStatus[] = [
  'ENDED', 'MISSED', 'REJECTED', 'CANCELLED', 'FAILED',
];

export const ACTIVE_STATUSES: CallStatus[] = [
  'CREATED', 'RINGING', 'ACCEPTED', 'CONNECTED', 'RECONNECTING',
];

const TRANSITIONS: Record<CallStatus, CallStatus[]> = {
  CREATED:      ['RINGING', 'CANCELLED', 'FAILED'],
  RINGING:      ['ACCEPTED', 'REJECTED', 'MISSED', 'CANCELLED', 'FAILED'],
  ACCEPTED:     ['CONNECTED', 'RECONNECTING', 'ENDED', 'FAILED'],
  CONNECTED:    ['RECONNECTING', 'ENDED', 'FAILED'],
  RECONNECTING: ['CONNECTED', 'ENDED', 'FAILED'],
  ENDED:        [],
  MISSED:       [],
  REJECTED:     [],
  CANCELLED:    [],
  FAILED:       [],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true; // idempotent
  return TRANSITIONS[from as CallStatus]?.includes(to as CallStatus) ?? false;
}

export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      `Không thể chuyển trạng thái cuộc gọi ${from} → ${to}`
    );
  }
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status as CallStatus);
}

/** Outcome dùng cho tin nhắn log trong conversation */
export function resolveOutcome(status: string): 'COMPLETED' | 'MISSED' | 'REJECTED' | 'CANCELLED' | 'FAILED' {
  switch (status) {
    case 'ENDED': return 'COMPLETED';
    case 'MISSED': return 'MISSED';
    case 'REJECTED': return 'REJECTED';
    case 'CANCELLED': return 'CANCELLED';
    default: return 'FAILED';
  }
}