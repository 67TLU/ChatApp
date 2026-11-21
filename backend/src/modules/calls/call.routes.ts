import { Router } from 'express';
import { CallController } from './call.controller';
import { CallMediaController } from './call.media.controller';
import { authMiddleware } from '@/common/middleware/auth.middleware';
import { validate } from '@/common/middleware/validate.middleware';
import { updateMediaSettingsSchema } from './call.media.validators';
import { ICE_SERVERS } from '@/config/webrtc';
import { CALL_CONFIG } from '@/config/call.config';

const router = Router();
const controller = new CallController();
const mediaController = new CallMediaController();

router.use(authMiddleware);

// Config cho client
router.get('/ice-servers', (_req, res) => {
  res.json({
    success: true,
    data: {
      iceServers: ICE_SERVERS,
      policy: {
        ringingTimeoutMs: CALL_CONFIG.RINGING_TIMEOUT_MS,
        reconnectGraceMs: CALL_CONFIG.RECONNECT_GRACE_MS,
        maxReconnectAttempts: CALL_CONFIG.MAX_RECONNECT_ATTEMPTS,
        maxConcurrentScreenShares: CALL_CONFIG.MAX_CONCURRENT_SCREEN_SHARES,
        qualityReportIntervalMs: CALL_CONFIG.QUALITY_REPORT_MIN_INTERVAL_MS,
      },
    },
  });
});

// Device settings
router.get('/media-settings', mediaController.getMediaSettings);
router.patch('/media-settings', validate(updateMediaSettingsSchema), mediaController.updateMediaSettings);

// Reconnect
router.get('/active', mediaController.getActiveCalls);
router.post('/:callId/resume', mediaController.resumeCall);

// Monitor
router.get('/:callId/quality', mediaController.getQualitySummary);
router.get('/:callId/screen-shares', mediaController.getActiveScreenShares);

// History & detail (giai đoạn 5) — đặt cuối để không nuốt route tĩnh
router.get('/history', controller.getCallHistory);
router.get('/:callId', controller.getCallInfo);

export default router;