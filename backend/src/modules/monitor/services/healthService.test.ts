import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../models/database", () => ({
  default: { prepare: () => ({ get: () => undefined, all: () => [] }) },
  db: { prepare: () => ({ get: () => undefined, all: () => [] }) },
  initializeDatabase: vi.fn(),
  performMaintenance: vi.fn(),
  getIOInstance: vi.fn(),
}));
import { healthService } from './healthService';

describe('healthService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should be defined", () => { expect(healthService).toBeDefined(); });

  it('checkHealth returns a health object with status field', async () => {
    const health = await healthService.checkHealth();
    expect(health).toBeDefined();
    expect(health).toHaveProperty('status');
    expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
  });

  it('checkHealth returns checks object', async () => {
    const health = await healthService.checkHealth();
    expect(health).toHaveProperty('checks');
    expect(typeof health.checks).toBe('object');
  });

  it('checkHealth returns timestamp', async () => {
    const health = await healthService.checkHealth();
    expect(health).toHaveProperty('timestamp');
  });
});
