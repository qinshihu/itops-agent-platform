/**
 * dcSlotService 业务规则测试
 *
 * 验证：
 *   - assignSlot: 冲突检测 → DcSlotBusinessError(409)
 *   - assignSlot: 容量校验 → DcSlotBusinessError(400)
 *   - assignSlot: 设备型号 u_height 继承
 *   - assignSlot: 写入 mounted 生命周期
 *   - moveSlot: 排除自身的冲突检测
 *   - moveSlot: 跨机柜移位 → 写入 moved 生命周期
 *   - removeSlot: 写入 unmounted 生命周期
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    slots: {
      findConflict: vi.fn(() => null),
      getById: vi.fn(() => undefined),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    racks: {
      getById: vi.fn(() => ({ id: 'r1', total_u: 42 })),
    },
    devices: {
      getDeviceTypeUHeight: vi.fn(() => null),
      listSlotDefinitions: vi.fn(() => []),
      createLifecycle: vi.fn(),
    },
  },
}));

vi.mock('../../../repositories', () => ({
  dcRepository: mockRepo,
}));

vi.mock('crypto', () => ({
  default: {
    randomUUID: () => 'mock-uuid',
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dcSlotService, DcSlotBusinessError } from './dcSlotService';

describe('dcSlotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.slots.findConflict.mockReturnValue(null);
    mockRepo.slots.getById.mockReturnValue(undefined);
    mockRepo.racks.getById.mockReturnValue({ id: 'r1', total_u: 42 });
    mockRepo.devices.getDeviceTypeUHeight.mockReturnValue(null);
    mockRepo.devices.listSlotDefinitions.mockReturnValue([]);
  });

  describe('assignSlot', () => {
    it('成功分配 U 位并写 mounted 生命周期', async () => {
      const result = await dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 10, end_u: 12,
      });
      expect(result).toEqual({ id: 'mock-uuid', end_u: 12 });
      expect(mockRepo.slots.create).toHaveBeenCalledWith(expect.objectContaining({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 10, end_u: 12,
      }));
      expect(mockRepo.devices.createLifecycle).toHaveBeenCalledWith(expect.objectContaining({
        action: 'mounted', to_rack_id: 'r1', to_slot_start: 10, to_slot_end: 12,
      }));
    });

    it('U 位冲突时抛 409', async () => {
      mockRepo.slots.findConflict.mockReturnValue({ id: 'existing-slot' });
      await expect(dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 5, end_u: 6,
      })).rejects.toThrow(DcSlotBusinessError);
      await expect(dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 5, end_u: 6,
      })).rejects.toMatchObject({ statusCode: 409 });
      expect(mockRepo.slots.create).not.toHaveBeenCalled();
    });

    it('超出机柜容量时抛 400', async () => {
      await expect(dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 40, end_u: 50,
      })).rejects.toThrow(DcSlotBusinessError);
      await expect(dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        start_u: 40, end_u: 50,
      })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('设备型号 u_height=2U → 自动算 end_u', async () => {
      mockRepo.devices.getDeviceTypeUHeight.mockReturnValue(2);
      const result = await dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        device_type_id: 'dt-1', start_u: 10, end_u: 99,
      });
      // 10 + 2 - 1 = 11（11 < 42 通过容量检查）
      expect(result.end_u).toBe(11);
    });

    it('u_height 缺省但 slot_definitions 有数据 → 用 maxU', async () => {
      mockRepo.devices.listSlotDefinitions.mockReturnValue([
        { u_position: 1 }, { u_position: 3 },
      ]);
      const result = await dcSlotService.assignSlot({
        rack_id: 'r1', device_id: 'd1', device_type: 'server',
        device_type_id: 'dt-1', start_u: 5, end_u: 99,
      });
      // 5 + 3 = 8（8 < 42 通过容量检查）
      expect(result.end_u).toBe(8);
    });
  });

  describe('moveSlot', () => {
    it('成功移位（同机柜内）不写生命周期', async () => {
      mockRepo.slots.getById.mockReturnValue({
        id: 's1', rack_id: 'r1', device_id: 'd1',
        start_u: 5, end_u: 6,
      });
      await dcSlotService.moveSlot({
        id: 's1', start_u: 10, end_u: 12,
      });
      expect(mockRepo.slots.update).toHaveBeenCalledWith('s1', expect.objectContaining({
        rack_id: 'r1', start_u: 10, end_u: 12,
      }));
      // 跨机柜才会写 moved 生命周期，同机柜只 update
      expect(mockRepo.devices.createLifecycle).not.toHaveBeenCalled();
    });

    it('跨机柜移位写 moved 生命周期', async () => {
      mockRepo.slots.getById.mockReturnValue({
        id: 's1', rack_id: 'r1', device_id: 'd1',
        start_u: 5, end_u: 6,
      });
      await dcSlotService.moveSlot({
        id: 's1', rack_id: 'r2', start_u: 10, end_u: 12,
      });
      expect(mockRepo.devices.createLifecycle).toHaveBeenCalledWith(expect.objectContaining({
        action: 'moved',
        from_rack_id: 'r1', to_rack_id: 'r2',
        from_slot_start: 5, to_slot_start: 10,
      }));
    });

    it('不存在的 slot 抛 404', async () => {
      mockRepo.slots.getById.mockReturnValue(undefined);
      await expect(dcSlotService.moveSlot({
        id: 'no-such', start_u: 10, end_u: 12,
      })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('目标位置冲突抛 409', async () => {
      mockRepo.slots.getById.mockReturnValue({
        id: 's1', rack_id: 'r1', device_id: 'd1',
        start_u: 5, end_u: 6,
      });
      mockRepo.slots.findConflict.mockReturnValue({ id: 'other-slot' });
      await expect(dcSlotService.moveSlot({
        id: 's1', start_u: 10, end_u: 12,
      })).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('removeSlot', () => {
    it('成功移除并写 unmounted 生命周期', async () => {
      mockRepo.slots.getById.mockReturnValue({
        id: 's1', rack_id: 'r1', device_id: 'd1',
        start_u: 5, end_u: 6,
      });
      await dcSlotService.removeSlot('s1');
      expect(mockRepo.devices.createLifecycle).toHaveBeenCalledWith(expect.objectContaining({
        action: 'unmounted', from_rack_id: 'r1', from_slot_start: 5,
      }));
      expect(mockRepo.slots.delete).toHaveBeenCalledWith('s1');
    });

    it('不存在的 slot 抛 404', async () => {
      mockRepo.slots.getById.mockReturnValue(undefined);
      await expect(dcSlotService.removeSlot('no-such'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
