import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { queueService, QueueJobType } from './queueService';
describe('queueService', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('should initialize without error', () => { expect(() => queueService.init()).not.toThrow(); });
  it('should enqueue a task', async () => {
    if (QueueJobType) {
      const id = await queueService.enqueue(QueueJobType.WORKFLOW_EXECUTION, { task: 'test' }, async () => 'done');
      expect(id).toBeDefined();
    }
  });
  it('should return stats', () => {
    const stats = queueService.stats();
    expect(stats).toBeDefined();
  });
  it('should shutdown gracefully', async () => {
    await expect(queueService.shutdown()).resolves.not.toThrow();
  });
});
