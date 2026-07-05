import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approvalsRepo: {
    getById: vi.fn(),
    update: vi.fn(),
  },
  resumeWorkflow: vi.fn(),
  rejectWorkflow: vi.fn(),
}));

vi.mock('../../../repositories', () => ({
  approvalsRepo: mocks.approvalsRepo,
}));

vi.mock('../../workflow/services/workflowExecutor', () => ({
  resumeWorkflow: mocks.resumeWorkflow,
  rejectWorkflow: mocks.rejectWorkflow,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { approvalService } from './approvalService';

describe('approvalService', () => {
  it('approve should resume workflow for pending approval', async () => {
    mocks.approvalsRepo.getById.mockReturnValue({
      id: 'approval-1',
      status: 'pending',
      task_id: 'task-1',
    });

    await approvalService.approve('approval-1', 'user-1', 'Looks good');

    expect(mocks.resumeWorkflow).toHaveBeenCalledWith('task-1', 'approval-1', 'user-1', 'Looks good');
  });

  it('approve should throw for non-pending approval', async () => {
    mocks.approvalsRepo.getById.mockReturnValue({
      id: 'approval-1',
      status: 'approved',
      task_id: 'task-1',
    });

    await expect(
      approvalService.approve('approval-1', 'user-1')
    ).rejects.toThrow('Approval already approved');
  });

  it('approve should throw for non-existent approval', async () => {
    mocks.approvalsRepo.getById.mockReturnValue(null);

    await expect(
      approvalService.approve('nonexistent', 'user-1')
    ).rejects.toThrow('Approval not found');
  });

  it('reject should reject workflow for pending approval', async () => {
    mocks.approvalsRepo.getById.mockReturnValue({
      id: 'approval-2',
      status: 'pending',
      task_id: 'task-2',
    });

    await approvalService.reject('approval-2', 'user-1', 'Not needed');

    expect(mocks.rejectWorkflow).toHaveBeenCalledWith('task-2', 'approval-2', 'user-1', 'Not needed');
  });

  it('reject should throw for non-pending approval', async () => {
    mocks.approvalsRepo.getById.mockReturnValue({
      id: 'approval-2',
      status: 'rejected',
      task_id: 'task-2',
    });

    await expect(
      approvalService.reject('approval-2', 'user-1', 'Already done')
    ).rejects.toThrow('Approval already rejected');
  });
});