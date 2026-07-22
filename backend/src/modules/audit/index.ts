/**
 * 审计日志模块（audit）
 *
 * 职责：审计日志写入（createAuditLog）+ 审计日志查询（list / getById / stats）
 * 阶段：P1-6 infra 按子域拆分阶段 3（2026-07-07）
 * 原位置：modules/infra/services/{auditService.ts, auditLogCrudService.ts} + routes/auditRoutes.ts
 */

export { default as routes } from './routes';
export { createAuditLog } from './services/auditService';
