/**
 * 系统级基础设施模块（infra）
 *
 * 职责：跨模块共用的系统级基础设施服务。
 *
 * 阶段：P1-6 infra 按子域拆分（2026-07-07）
 *   历史：infra 模块曾包含 6 路由 + 12 服务，过载
 *   当前：仅保留 `restartService`（系统优雅重启 + 关闭钩子注册）
 *   已抽离子域：
 *     - settings/        — 系统设置
 *     - scripts/         — 脚本/终端
 *     - audit/           — 审计日志
 *     - tool-links/      — 工具链接
 *     - linkage/         — 联动统计
 *     - import-export/   — 数据导入导出
 *     - reportService  → monitor/services/reportService（业务归属更准确）
 *
 * 依赖：workflow（schedulerService）、backup（shutdown hook）
 */

export { default as routes } from './routes';
export * from './services/restartService';
