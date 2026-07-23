/**
 * dcCrudService — DC 模块路由层 CRUD 抽象（v2 报告 P1 闭环）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2 / depcruise `routes-禁止直访-Repository` 规则。
 *
 * 设计说明：
 *   - 本 service 当前主要做**门面封装**（薄包装 dcRepository 方法），确保 routes 不再直访 repository。
 *   - 复杂业务规则（如 dcSlotService 的 U 位冲突/容量校验）保持独立 service，本 service 不重复实现。
 *   - 后续可按 P1-#15d 计划逐步将 CRUD 方法按实体拆为 dcRoomCrudService / dcRackCrudService / dcSlotCrudService 等子 service。
 *
 * 边界规则（保持与 architecture.md §3.2 一致）：
 *   - routes 严禁直接 import `repositories/`
 *   - 所有路由方法都通过本 service 调用底层 dcRepository
 *   - 业务规则集中放在 dcSlotService / dcStatusService / dcPduSnmpService / dcRoomEnvironmentService
 *
 * 实现策略：直接暴露 dcRepository 的子对象引用（rooms/racks/slots/devices/pdus/cables/power），
 *           通过类型标注使 routes 调用风格保持不变：dcCrudService.slots.list() === dcRepository.slots.list()
 *
 * 2026-07-23 修复：同时暴露 slotsBusiness service（专门处理 U 位冲突/容量/生命周期），
 * 让 routes/slots.ts 内联的业务规则全部下沉到 dcSlotService，避免两个版本不同步。
 */

import { dcRepository } from '../../../repositories';
import { dcSlotService } from './dcSlotService';

// 透传子对象引用（确保 routes 调用方式不变，仅改变来源）
export const dcCrudService = {
  rooms: dcRepository.rooms,
  racks: dcRepository.racks,
  slots: dcRepository.slots,
  devices: dcRepository.devices,
  pdus: dcRepository.pdus,
  cables: dcRepository.cables,
  power: dcRepository.power,
  // 2026-07-23 新增：暴露复杂 U 位业务，让 routes/slots.ts 不再内联
  slotsBusiness: dcSlotService,
};

export default dcCrudService;
