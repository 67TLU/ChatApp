import { z } from 'zod';

export const callIdParamSchema = z.object({
  callId: z.string().uuid(),
});

export const startScreenShareSchema = z.object({
  callId: z.string().uuid(),
  sourceType: z.enum(['SCREEN', 'WINDOW', 'TAB']).optional(),
  withAudio: z.boolean().optional(),
});

export const stopScreenShareSchema = z.object({
  callId: z.string().uuid(),
});

export const resumeCallSchema = z.object({
  callId: z.string().uuid(),
});

export const qualityReportSchema = z.object({
  callId: z.string().uuid(),
  rttMs: z.number().min(0).max(60_000).optional(),
  packetLoss: z.number().min(0).max(100).optional(),
  jitterMs: z.number().min(0).max(10_000).optional(),
  bitrateKbps: z.number().min(0).max(1_000_000).optional(),
  frameWidth: z.number().int().min(0).max(7680).optional(),
  frameHeight: z.number().int().min(0).max(4320).optional(),
  framesPerSecond: z.number().int().min(0).max(120).optional(),
});

export const updateMediaSettingsSchema = z.object({
  audioInputId: z.string().max(255).nullable().optional(),
  audioOutputId: z.string().max(255).nullable().optional(),
  videoInputId: z.string().max(255).nullable().optional(),
  audioInputLabel: z.string().max(255).nullable().optional(),
  audioOutputLabel: z.string().max(255).nullable().optional(),
  videoInputLabel: z.string().max(255).nullable().optional(),
  echoCancellation: z.boolean().optional(),
  noiseSuppression: z.boolean().optional(),
  autoGainControl: z.boolean().optional(),
  videoResolution: z.enum(['360p', '480p', '720p', '1080p']).optional(),
  videoFrameRate: z.number().int().min(5).max(60).optional(),
  joinMuted: z.boolean().optional(),
  joinVideoOff: z.boolean().optional(),
});

export const switchDeviceSchema = z.object({
  callId: z.string().uuid(),
  kind: z.enum(['AUDIO_INPUT', 'AUDIO_OUTPUT', 'VIDEO_INPUT']),
  deviceId: z.string().max(255),
  label: z.string().max(255).optional(),
});