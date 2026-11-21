import { CallMediaRepository } from './call.media.repository';
import { AppError } from '@/common/errors/app.error';
import { ErrorCodes } from '@/common/errors/error.codes';

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '360p': { width: 640, height: 360 },
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
};

export class MediaSettingsService {
  private repo = new CallMediaRepository();

  async getSettings(userId: string) {
    const settings = await this.repo.getMediaSettings(userId);

    const defaults = {
      userId,
      audioInputId: null,
      audioOutputId: null,
      videoInputId: null,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      videoResolution: '720p',
      videoFrameRate: 30,
      joinMuted: false,
      joinVideoOff: false,
    };

    const merged = { ...defaults, ...(settings ?? {}) };

    return {
      ...merged,
      // Trả về constraints sẵn để client gọi getUserMedia
      mediaConstraints: this.buildConstraints(merged),
    };
  }

  async updateSettings(userId: string, data: {
    audioInputId?: string | null;
    audioOutputId?: string | null;
    videoInputId?: string | null;
    audioInputLabel?: string | null;
    audioOutputLabel?: string | null;
    videoInputLabel?: string | null;
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    videoResolution?: string;
    videoFrameRate?: number;
    joinMuted?: boolean;
    joinVideoOff?: boolean;
  }) {
    if (data.videoResolution && !RESOLUTION_MAP[data.videoResolution]) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Độ phân giải không hỗ trợ');
    }
    if (data.videoFrameRate !== undefined && (data.videoFrameRate < 5 || data.videoFrameRate > 60)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Frame rate phải trong khoảng 5–60');
    }

    const updated = await this.repo.upsertMediaSettings(userId, data as any);
    return { ...updated, mediaConstraints: this.buildConstraints(updated) };
  }

  /** Client dùng object này cho navigator.mediaDevices.getUserMedia */
  buildConstraints(settings: any) {
    const res = RESOLUTION_MAP[settings.videoResolution ?? '720p'];
    const fps = settings.videoFrameRate ?? 30;

    return {
      audio: {
        deviceId: settings.audioInputId ? { exact: settings.audioInputId } : undefined,
        echoCancellation: settings.echoCancellation ?? true,
        noiseSuppression: settings.noiseSuppression ?? true,
        autoGainControl: settings.autoGainControl ?? true,
      },
      video: {
        deviceId: settings.videoInputId ? { exact: settings.videoInputId } : undefined,
        width: { ideal: res.width },
        height: { ideal: res.height },
        frameRate: { ideal: fps, max: fps },
      },
    };
  }
}