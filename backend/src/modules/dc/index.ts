/**
 * 数据中心模块
 *
 * 职责：基础设施管理（机柜/设备/线缆/电源）、生命周期管理、机房监控、3D 可视化
 * 依赖：无
 */

export { default as routes } from './routes';
// 2026-07-23：暴露 services 给可能的后台 worker / scheduler 调用
export { dcCrudService, dcSlotService } from './services/dcCrudService';
