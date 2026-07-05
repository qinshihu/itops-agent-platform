/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v050 — vm_snapshot_policies 表
 *
 * 从 modules/containers/services/vmSnapshotSchedulerService.ensureTables() 下沉而来。
 * 虚拟机快照策略持久化表（不含运行时 loadPolicies 逻辑，仅 schema）。
 */
const v050VmSnapshotPolicies: Migration = {
  id: '20250101000050',
  version: 50,
  name: 'vm_snapshot_policies',
  description: 'VM snapshot scheduling policies table (migrated from vmSnapshotSchedulerService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vm_snapshot_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        platform_id TEXT NOT NULL,
        vm_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        retention INTEGER DEFAULT 7,
        snapshot_memory INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS vm_snapshot_policies`);
  },
};

export default v050VmSnapshotPolicies;
