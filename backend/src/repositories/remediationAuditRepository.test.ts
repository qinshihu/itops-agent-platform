/**
 * remediationAuditRepository 测试
 *
 * 验证：
 *   - getById 执行正确 SQL
 *   - container.replace() 可注入 mock
 *
 * 注意：当前 repository 仅含 getById 一个方法，测试覆盖其行为契约。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  };
  return { mockDb };
});

vi.mock('../models/database', () => ({ default: mockDb }));

import { remediationAuditRepository } from './remediationAuditRepository';
import { container } from '../core/serviceContainer';

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('remediationAuditRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('执行 SELECT * FROM remediation_audits WHERE id = ?', () => {
      const getSpy = vi.fn(() => ({ id: 'a1', rca_id: 'r1', server_id: 's1' }));
      mockDb.prepare = vi.fn((sql: string) => {
        expect(sql).toContain('SELECT * FROM remediation_audits');
        expect(sql).toContain('WHERE id = ?');
        return { run: vi.fn(), get: getSpy, all: vi.fn() };
      });

      const result = remediationAuditRepository.getById('a1');
      expect(result?.rca_id).toBe('r1');
      expect(getSpy).toHaveBeenCalledWith('a1');
    });

    it('不存在时返回 undefined', () => {
      mockDb.prepare = vi.fn(() => ({
        run: vi.fn(), get: vi.fn(() => undefined), all: vi.fn(),
      }));
      expect(remediationAuditRepository.getById('missing')).toBeUndefined();
    });
  });

  describe('DI container.replace()', () => {
    it('可通过 container.replace() 注入 mock', () => {
      const mockRepo = { getById: vi.fn(() => ({ id: 'mocked' })) };
      container.replace('remediationAuditRepository', mockRepo);
      const result = container.get<typeof mockRepo>('remediationAuditRepository');
      expect(result).toBe(mockRepo);
      expect(result.getById('any').id).toBe('mocked');
    });
  });
});
