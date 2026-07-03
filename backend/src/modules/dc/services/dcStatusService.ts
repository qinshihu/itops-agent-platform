import type { Server as SocketIOServer } from 'socket.io';
import { racksRepo, slotsRepo, roomsRepo } from '../../../repositories';
import { emitToDC } from '../../../shared/websocket/handler';
import { logger } from '../../../utils/logger';

let intervalId: ReturnType<typeof setInterval> | null = null;

/** 轮询 DC 概览数据并推送到 WebSocket */
function pollAndEmit(io: SocketIOServer) {
  try {
    // 统计
    const rackCount = racksRepo.count();
    const slotCount = slotsRepo.count();
    const deviceCount = slotsRepo.countOccupied();
    const onlineCount = slotsRepo.countOnlineServerDevices();

    // 机柜实时利用率
    const rackUtil = racksRepo.listWithOccupiedUtil();

    // 房间温湿度
    const roomEnv = roomsRepo.list();

        // 告警统计 — 按机房关联的设备 ID 统计，避免 title 误匹配（如 "disk corruption"）
    const alertCount = slotsRepo.countAlertDevices();

    emitToDC(io, 'dc:status', {
      timestamp: Date.now(),
      summary: {
        totalRacks: rackCount,
        totalSlots: slotCount,
        totalDevices: deviceCount,
        onlineDevices: onlineCount,
        alertDevices: alertCount,
      },
      rackUtil,
      roomEnv,
    });
  } catch (err) {
    logger.error('DC status poll error:', err as Error);
  }
}

/** 启动 DC 状态推送（默认每 5 秒轮询） */
export function startDCStatusPush(io: SocketIOServer, intervalMs = 5000) {
  if (intervalId) return;
  logger.info(`🏢 DC status push started (interval: ${intervalMs}ms)`);
  // 立即推一次
  pollAndEmit(io);
  intervalId = setInterval(() => pollAndEmit(io), intervalMs);
}

export function stopDCStatusPush() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('🏢 DC status push stopped');
  }
}
