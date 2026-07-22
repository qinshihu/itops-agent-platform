/**
 * 联动统计模块（linkage）
 *
 * 职责：巡检中心（inspection-center）/设备概览/仪表盘联动统计/历史趋势
 * 阶段：P1-6 infra 按子域拆分阶段 7（2026-07-07）
 * 原位置：modules/infra/{routes/linkageRoutes.ts, services/linkageService.ts}
 */

export { default as routes } from './routes';
export { linkageService } from './services/linkageService';
