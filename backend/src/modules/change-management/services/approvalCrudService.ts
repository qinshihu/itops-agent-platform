/**
 * Approval 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 */
import { approvalsRepo } from '../../../repositories';

export const approvalCrudService = {
  listApprovals(filters: { status?: string; limit?: number } = {}) {
    return approvalsRepo.list(filters);
  },

  countPendingApprovals() {
    return approvalsRepo.countPending();
  },

  getApprovalById(id: string) {
    return approvalsRepo.getById(id);
  },
};
