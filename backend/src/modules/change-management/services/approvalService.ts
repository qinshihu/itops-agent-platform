import { approvalsRepo } from '../../../repositories';
import { resumeWorkflow, rejectWorkflow } from '../../workflow/services/workflowExecutor';

export const approvalService = {
  /**
   * 审批通过 — 恢复工作流执行
   */
  async approve(approvalId: string, userId: string, comment?: string): Promise<void> {
    const approval = approvalsRepo.getById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }
    if (approval.status !== 'pending') {
      throw new Error(`Approval already ${approval.status}`);
    }

    await resumeWorkflow(approval.task_id, approvalId, userId, comment);
  },

  /**
   * 审批拒绝 — 终止工作流
   */
  async reject(approvalId: string, userId: string, reason: string): Promise<void> {
    const approval = approvalsRepo.getById(approvalId);
    if (!approval) {
      throw new Error('Approval not found');
    }
    if (approval.status !== 'pending') {
      throw new Error(`Approval already ${approval.status}`);
    }

    await rejectWorkflow(approval.task_id, approvalId, userId, reason);
  },
};
