/**
 * Audit Log 路由层读模式抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 区分：
 *   - auditLogCrudService（本文件）：日志查询（list/getById）
 *   - auditService.createAuditLog：审计日志写入（被其它模块使用）
 */
import { auditLogRepository } from '../../../repositories';
import type { AuditLogListFilters } from '../../../repositories';

export const auditLogCrudService = {
  /**
   * 分页列出审计日志（自动拼装 filters + 返回 {logs,total,page,limit}）
   */
  listLogs(query: { page?: string; limit?: string; action?: string; resource_type?: string; user_id?: string; start_date?: string; end_date?: string }) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '50', 10);
    const filters: AuditLogListFilters = {
      limit,
      offset: (page - 1) * limit,
    };
    if (query.action) filters.action = query.action;
    if (query.resource_type) filters.resource_type = query.resource_type;
    if (query.user_id) filters.user_id = query.user_id;
    if (query.start_date) filters.start_date = query.start_date;
    if (query.end_date) filters.end_date = query.end_date;

    const logs = auditLogRepository.list(filters);
    const total = auditLogRepository.count(filters);
    return { logs, total, page, limit };
  },

  getLogById(id: string) {
    return auditLogRepository.getById(id);
  },

  /**
   * 审计统计信息（action 维度 / resource 维度 / 今日 / 失败）
   */
  getStatsSummary() {
    return {
      actionStats: auditLogRepository.getActionStats(),
      resourceStats: auditLogRepository.getResourceStats(),
      todayCount: auditLogRepository.getTodayCount(),
      failureCount: 0,  // 暂未持久化失败计数
    };
  },
};
