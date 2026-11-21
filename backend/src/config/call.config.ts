export const CALL_CONFIG = {
  // Thời gian đổ chuông trước khi MISSED
  RINGING_TIMEOUT_MS: 30_000,

  // Thời gian chờ reconnect trước khi bị loại khỏi cuộc gọi
  RECONNECT_GRACE_MS: 30_000,

  // Số lần reconnect tối đa / participant
  MAX_RECONNECT_ATTEMPTS: 5,

  // Số người share màn hình đồng thời trong 1 phòng
  MAX_CONCURRENT_SCREEN_SHARES: 1,

  // Giới hạn người tham gia cuộc gọi P2P (giai đoạn 6 chỉ 1-1)
  MAX_P2P_PARTICIPANTS: 2,

  // Khoảng cách tối thiểu giữa 2 lần report quality (chống spam)
  QUALITY_REPORT_MIN_INTERVAL_MS: 5_000,

  // Ngưỡng đánh giá chất lượng
  QUALITY_THRESHOLDS: {
    POOR_RTT_MS: 400,
    POOR_PACKET_LOSS: 8,   // %
    MODERATE_RTT_MS: 200,
    MODERATE_PACKET_LOSS: 3,
  },

  // Dọn cuộc gọi "mồ côi" (server crash, timeout không chạy)
  STALE_CALL_SWEEP_INTERVAL_MS: 60_000,
  STALE_CALL_MAX_AGE_MS: 6 * 60 * 60 * 1000, // 6h
} as const;