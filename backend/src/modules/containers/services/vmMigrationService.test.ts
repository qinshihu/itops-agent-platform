import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks ====================
// All mock objects must be defined INLINE inside vi.mock factories
// because vi.mock calls are hoisted above const declarations.

vi.mock('../../../models/database', () => {
  const stmt = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };
  return {
    default: {
      prepare: vi.fn(() => stmt),
    },
  };
});

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../containers/services/vmManagement', () => ({
  vmManagementService: {
    getVM: vi.fn(),
  },
}));

import db from '../../../models/database';
import { vmMigrationService } from './vmMigrationService';
import { vmManagementService } from '../../containers/services/vmManagement';

// Helper to get the mock statement from db
// db.prepare is a vi.fn that returns the stmt object
function getMockStmt() {
  return db.prepare('') as unknown as { all: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn> };
}

// ==================== Helpers ====================

function createMigrationRow(overrides: Record<string, any> = {}) {
  return {
    id: 'mig-001',
    vm_id: 'vm-001',
    vm_name: 'test-vm',
    source_host: 'host-a',
    target_host: 'host-b',
    platform_id: 'plat-001',
    status: 'running',
    progress: 50,
    reason: 'maintenance',
    error_message: null,
    started_at: '2024-01-01T00:00:00.000Z',
    completed_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function expectMigrationShape(migration: any) {
  expect(migration).toHaveProperty('id');
  expect(migration).toHaveProperty('vmId');
  expect(migration).toHaveProperty('vmName');
  expect(migration).toHaveProperty('sourceHost');
  expect(migration).toHaveProperty('targetHost');
  expect(migration).toHaveProperty('platformId');
  expect(migration).toHaveProperty('status');
  expect(migration).toHaveProperty('progress');
  expect(migration).toHaveProperty('createdAt');
}

// ==================== Tests ====================

describe('VmMigrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const stmt = getMockStmt();
    if (stmt) {
      stmt.all.mockReturnValue([]);
      stmt.get.mockReturnValue(undefined);
      stmt.run.mockReturnValue({ changes: 1 });
    }
    // Reset singleton state
    (vmMigrationService as any).activeMigrations.clear();
    const intervals: Map<string, NodeJS.Timeout> = (vmMigrationService as any).progressIntervals;
    if (intervals) {
      intervals.forEach((iv: NodeJS.Timeout) => clearInterval(iv));
      intervals.clear();
    }
  });

  afterEach(() => {
    // Ensure all intervals are cleared
    (vmMigrationService as any).activeMigrations.clear();
    const intervals: Map<string, NodeJS.Timeout> = (vmMigrationService as any).progressIntervals;
    if (intervals) {
      intervals.forEach((iv: NodeJS.Timeout) => clearInterval(iv));
      intervals.clear();
    }
  });

  // ---- startMigration() ----

  describe('startMigration()', () => {
    it('should throw when VM does not exist', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce(null as any);

      await expect(
        vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b')
      ).rejects.toThrow('VM 不存在');
    });

    it('should throw when VM is not running', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-001',
        name: 'test-vm',
        host: 'host-a',
        status: 'stopped',
      } as any);

      await expect(
        vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b')
      ).rejects.toThrow('仅运行中的 VM 支持迁移');
    });

    it('should start migration and insert into database', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-001',
        name: 'test-vm',
        host: 'host-a',
        status: 'running',
      } as any);

      const stmt = getMockStmt();
      const task = await vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b', 'scale-up');

      expect(task).toBeDefined();
      expect(task.vmId).toBe('vm-001');
      expect(task.vmName).toBe('test-vm');
      expect(task.sourceHost).toBe('host-a');
      expect(task.targetHost).toBe('host-b');
      expect(task.platformId).toBe('plat-001');
      expect(task.status).toBe('running');
      expect(task.progress).toBeGreaterThanOrEqual(0);
      expect(task.reason).toBe('scale-up');
      expect(task.startedAt).toBeDefined();

      // Verify DB insert
      expect(stmt.run).toHaveBeenCalledWith(
        task.id,
        'vm-001',
        'test-vm',
        'host-a',
        'host-b',
        'plat-001',
        'running',
        'scale-up',
        expect.any(String), // startedAt
      );
    });

    it('should handle missing source host gracefully', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-002',
        name: 'no-host-vm',
        status: 'running',
      } as any);

      const task = await vmMigrationService.startMigration('plat-001', 'vm-002', 'host-c');

      expect(task.sourceHost).toBe('unknown');
    });

    it('should add task to active migrations', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-001',
        name: 'test-vm',
        host: 'host-a',
        status: 'running',
      } as any);

      const task = await vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b');

      const active = vmMigrationService.getActiveMigrations();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(task.id);
    });
  });

  // ---- getMigration() ----

  describe('getMigration()', () => {
    it('should return migration from database', () => {
      const stmt = getMockStmt();
      const row = createMigrationRow();
      stmt.get.mockReturnValue(row);

      const result = vmMigrationService.getMigration('mig-001');

      expect(result).not.toBeNull();
      expectMigrationShape(result!);
      expect(result!.id).toBe('mig-001');
      expect(result!.vmId).toBe('vm-001');
      expect(result!.status).toBe('running');
      expect(result!.progress).toBe(50);
    });

    it('should return null when migration not found', () => {
      const stmt = getMockStmt();
      stmt.get.mockReturnValue(undefined);

      const result = vmMigrationService.getMigration('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- listMigrations() ----

  describe('listMigrations()', () => {
    it('should return all migrations ordered by created_at desc', () => {
      const stmt = getMockStmt();
      const rows = [
        createMigrationRow({ id: 'mig-002', vm_id: 'vm-002', vm_name: 'vm2' }),
        createMigrationRow({ id: 'mig-001', vm_id: 'vm-001', vm_name: 'vm1' }),
      ];
      stmt.all.mockReturnValue(rows);

      const result = vmMigrationService.listMigrations();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('mig-002');
      expect(result[1].id).toBe('mig-001');
    });

    it('should filter by vmId when provided', () => {
      const stmt = getMockStmt();
      const rows = [createMigrationRow()];
      stmt.all.mockReturnValue(rows);

      const result = vmMigrationService.listMigrations('vm-001');

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE vm_id = ?')
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no migrations', () => {
      const stmt = getMockStmt();
      stmt.all.mockReturnValue([]);

      const result = vmMigrationService.listMigrations();

      expect(result).toEqual([]);
    });
  });

  // ---- cancelMigration() ----

  describe('cancelMigration()', () => {
    it('should return false when migration is not active', () => {
      const result = vmMigrationService.cancelMigration('nonexistent');

      expect(result).toBe(false);
    });

    it('should cancel an active migration', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-001',
        name: 'test-vm',
        host: 'host-a',
        status: 'running',
      } as any);

      const task = await vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b');

      const result = vmMigrationService.cancelMigration(task.id);

      expect(result).toBe(true);
      // Task should be removed from active migrations
      expect(vmMigrationService.getActiveMigrations()).toHaveLength(0);
      // DB should be updated with cancelled status
      const cancelledCalls = (db.prepare as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('cancelled')
      );
      expect(cancelledCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- getActiveMigrations() ----

  describe('getActiveMigrations()', () => {
    it('should return empty array when no active migrations', () => {
      const result = vmMigrationService.getActiveMigrations();

      expect(result).toEqual([]);
    });

    it('should return active migrations after starting one', async () => {
      vi.mocked(vmManagementService.getVM).mockResolvedValueOnce({
        id: 'vm-001',
        name: 'test-vm',
        host: 'host-a',
        status: 'running',
      } as any);

      await vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b');

      const active = vmMigrationService.getActiveMigrations();
      expect(active).toHaveLength(1);
      expect(active[0].status).toBe('running');
    });
  });

  // ---- error handling ----

  describe('error handling', () => {
    it('should propagate errors from vmManagementService', async () => {
      vi.mocked(vmManagementService.getVM).mockRejectedValueOnce(new Error('Network error'));

      await expect(
        vmMigrationService.startMigration('plat-001', 'vm-001', 'host-b')
      ).rejects.toThrow('Network error');
    });
  });
});