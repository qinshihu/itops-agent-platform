import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';

const mocks = vi.hoisted(() => ({
  racksRepo: {
    count: vi.fn(() => 2),
    listWithOccupiedUtil: vi.fn(() => [{ rack_id: 'rack-1', occupied: 3 }]),
  },
  slotsRepo: {
    count: vi.fn(() => 42),
    countOccupied: vi.fn(() => 10),
    countOnlineServerDevices: vi.fn(() => 8),
    countAlertDevices: vi.fn(() => 1),
  },
  roomsRepo: {
    list: vi.fn(() => [{ id: 'room-1', name: '主机房' }]),
  },
  emitToDC: vi.fn(),
}));

vi.mock('../../../repositories', () => ({
  racksRepo: mocks.racksRepo,
  slotsRepo: mocks.slotsRepo,
  roomsRepo: mocks.roomsRepo,
}));

vi.mock('../../../shared/websocket/handler', () => ({
  emitToDC: mocks.emitToDC,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { startDCStatusPush, stopDCStatusPush } from './dcStatusService';

describe('dcStatusService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopDCStatusPush();
  });

  it('启动时立即推送 DC 状态汇总', () => {
    const io = {} as SocketIOServer;

    startDCStatusPush(io, 60_000);

    expect(mocks.racksRepo.count).toHaveBeenCalled();
    expect(mocks.slotsRepo.count).toHaveBeenCalled();
    expect(mocks.slotsRepo.countOccupied).toHaveBeenCalled();
    expect(mocks.slotsRepo.countOnlineServerDevices).toHaveBeenCalled();
    expect(mocks.slotsRepo.countAlertDevices).toHaveBeenCalled();
    expect(mocks.emitToDC).toHaveBeenCalledWith(
      io,
      'dc:status',
      expect.objectContaining({
        summary: {
          totalRacks: 2,
          totalSlots: 42,
          totalDevices: 10,
          onlineDevices: 8,
          alertDevices: 1,
        },
        rackUtil: [{ rack_id: 'rack-1', occupied: 3 }],
        roomEnv: [{ id: 'room-1', name: '主机房' }],
      })
    );

    stopDCStatusPush();
  });

  it('重复启动不会创建额外推送', () => {
    const io = {} as SocketIOServer;

    startDCStatusPush(io, 60_000);
    startDCStatusPush(io, 60_000);

    expect(mocks.emitToDC).toHaveBeenCalledTimes(1);

    stopDCStatusPush();
  });
});
