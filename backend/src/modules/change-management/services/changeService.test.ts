import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(() => []),
    })),
    exec: vi.fn(),
  },
}));

vi.mock('../../../models/database', () => ({ default: mocks.db }));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { changeService, type ChangeInput } from './changeService';

describe('changeService', () => {
  it('create should return a ChangeRecord', () => {
    const runSpy = vi.fn();
    const getSpy = vi.fn(() => ({
      id: 'change-1',
      server_id: 'srv-1',
      change_type: 'config',
      description: 'Test change',
      changed_by: 'admin',
      status: 'completed',
      related_alert_id: null,
      is_root_cause: 0,
      metadata: '{}',
      created_at: '2026-01-01T00:00:00.000Z',
    }));

    mocks.db.prepare.mockImplementation(() => ({
      run: runSpy,
      get: getSpy,
      all: vi.fn(() => []),
    }));

    const input: ChangeInput = {
      server_id: 'srv-1',
      change_type: 'config',
      description: 'Test change',
      changed_by: 'admin',
    };

    const record = changeService.create(input);
    expect(record.id).toBeDefined();
    expect(record.server_id).toBe('srv-1');
    expect(record.change_type).toBe('config');
    expect(record.is_root_cause).toBe(false);
  });

  it('list should return paginated results', () => {
    mocks.db.prepare.mockImplementation(() => ({
      run: vi.fn(),
      get: vi.fn(() => ({ total: 0 })),
      all: vi.fn(() => []),
    }));

    const result = changeService.list({ page: 1, limit: 10 });
    expect(result.records).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  it('get should return null for non-existent record', () => {
    mocks.db.prepare.mockImplementation(() => ({
      run: vi.fn(),
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
    }));

    const record = changeService.get('nonexistent');
    expect(record).toBeNull();
  });
});