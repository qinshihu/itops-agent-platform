/**
 * Remediation Execution 路由层抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中暴露执行/审计/回滚等"路由层需要查询"的入口。
 * 内部仍由 executionTracker / remediationActions / verificationRollback 提供业务能力。
 */
import { remediationAuditRepository } from '../../../repositories';

export const remediationExecutionService = {
  /**
   * 获取单条审计（含关联策略/告警）
   */
  getAuditById(id: string) {
    return remediationAuditRepository.getByIdWithJoins(id);
  },

  /**
   * 获取单条审计（不含关联，用于 routes 仅做存在性校验）
   */
  getAuditExists(id: string) {
    return remediationAuditRepository.getById(id);
  },
};
