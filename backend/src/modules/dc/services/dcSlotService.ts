/**
 * dcSlotService — U 位分配/移位/移除 业务规则
 *
 * 从 routes/dc/slots.ts 下沉业务逻辑：
 *   - 冲突检测
 *   - U 位容量校验
 *   - 设备型号 u_height 继承
 *   - 生命周期自动记录
 *
 * routes 层只做参数校验 + 调 service。
 */

import crypto from 'crypto';
import { logger } from '../../../utils/logger';
import { dcRepository } from '../../../repositories';

export interface AssignSlotInput {
  rack_id: string;
  device_id: string;
  device_type: string;
  device_type_id?: string | null;
  start_u: number;
  end_u: number;
  position_face?: string;
  lifecycle_notes?: string;
}

export interface MoveSlotInput {
  id: string;
  rack_id?: string;
  start_u: number;
  end_u: number;
  position_face?: string;
  lifecycle_notes?: string;
}

export class DcSlotBusinessError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const dcSlotService = {
  /**
   * 分配 U 位给设备
   * 业务规则：
   *   1) 区间冲突检查（409）
   *   2) 超出机柜容量检查（400）
   *   3) 设备型号 u_height 继承（自动算 end_u）
   *   4) 写生命周期：action='mounted'
   */
  async assignSlot(input: AssignSlotInput): Promise<{ id: string; end_u: number }> {
    // 1) 冲突检查（先按 input.end_u 预检，避免占位 U 位错判）
    const conflict = dcRepository.slots.findConflict(input.rack_id, input.start_u, input.end_u);
    if (conflict) {
      throw new DcSlotBusinessError('U 位冲突：该 U 位已被占用', 409);
    }

    // 2) 设备型号 u_height 继承
    //   优先用 device_types.u_height（型号本身高度）
    //   缺省时尝试用 device_type_slot_definitions 的总高度
    //   都没则用 input.end_u
    let resolvedEndU = input.end_u;
    if (input.device_type_id) {
      const uHeight = dcRepository.devices.getDeviceTypeUHeight(input.device_type_id);
      if (uHeight && uHeight > 0) {
        resolvedEndU = input.start_u + Math.ceil(uHeight) - 1;
      } else {
        // 尝试从 slot_definitions 推断（如 net work 设备多端口累加）
        const defs = dcRepository.devices.listSlotDefinitions(input.device_type_id);
        if (defs.length > 0) {
          const maxU = defs.reduce((m, d) => Math.max(m, d.u_position || 0), 0);
          if (maxU > 0) resolvedEndU = input.start_u + maxU;
        }
      }
    }

    // 3) 容量校验（用解析后的 endU，比 input.end_u 更准确）
    const rack = dcRepository.racks.getById(input.rack_id);
    if (rack && resolvedEndU > (rack.total_u ?? 42)) {
      throw new DcSlotBusinessError(`超出机柜容量(最大${rack.total_u}U)`);
    }

    // 4) 写 slot
    const id = crypto.randomUUID();
    dcRepository.slots.create({
      id,
      rack_id: input.rack_id,
      device_id: input.device_id,
      device_type: input.device_type,
      device_type_id: input.device_type_id ?? null,
      start_u: input.start_u,
      end_u: resolvedEndU,
      position_face: input.position_face,
    });

    // 5) 写生命周期
    dcRepository.devices.createLifecycle({
      id: crypto.randomUUID(),
      device_id: input.device_id,
      device_type: input.device_type,
      action: 'mounted',
      to_rack_id: input.rack_id,
      to_slot_start: input.start_u,
      to_slot_end: input.end_u,
      notes: input.lifecycle_notes || '',
    });

    logger.info(`📌 Slot assigned: ${input.device_id} → rack=${input.rack_id} U${input.start_u}-${resolvedEndU}`);

    return { id, end_u: resolvedEndU };
  },

  /**
   * 移位/换机柜
   * 业务规则：
   *   1) 排除自身的冲突检查（409）
   *   2) 跨机柜时写 'moved' 生命周期
   */
  async moveSlot(input: MoveSlotInput): Promise<void> {
    const oldSlot = dcRepository.slots.getById(input.id);
    if (!oldSlot) {
      throw new DcSlotBusinessError('U 位记录不存在', 404);
    }

    const effectiveRackId = input.rack_id || oldSlot.rack_id;
    const conflict = dcRepository.slots.findConflict(
      effectiveRackId, input.start_u, input.end_u, input.id
    );
    if (conflict) {
      throw new DcSlotBusinessError('U 位冲突', 409);
    }

    dcRepository.slots.update(input.id, {
      rack_id: effectiveRackId,
      start_u: input.start_u,
      end_u: input.end_u,
      position_face: input.position_face,
    });

    // 跨机柜移位时写生命周期
    if (effectiveRackId !== oldSlot.rack_id) {
      dcRepository.devices.createLifecycle({
        id: crypto.randomUUID(),
        device_id: String(oldSlot.device_id ?? ''),
        device_type: String(oldSlot.device_type_id ?? ''),
        action: 'moved',
        from_rack_id: oldSlot.rack_id,
        to_rack_id: effectiveRackId,
        from_slot_start: Number(oldSlot.start_u),
        from_slot_end: Number(oldSlot.end_u),
        to_slot_start: input.start_u,
        to_slot_end: input.end_u,
        notes: input.lifecycle_notes || '',
      });
    }
  },

  /**
   * 移除 U 位（下架设备）
   * 写生命周期：action='unmounted'
   */
  async removeSlot(id: string): Promise<void> {
    const slot = dcRepository.slots.getById(id);
    if (!slot) {
      throw new DcSlotBusinessError('U 位记录不存在', 404);
    }

    dcRepository.devices.createLifecycle({
      id: crypto.randomUUID(),
      device_id: String(slot.device_id ?? ''),
      device_type: String(slot.device_type_id ?? ''),
      action: 'unmounted',
      from_rack_id: slot.rack_id,
      from_slot_start: Number(slot.start_u),
      from_slot_end: Number(slot.end_u),
      notes: '',
    });

    dcRepository.slots.delete(id);
  },
};
