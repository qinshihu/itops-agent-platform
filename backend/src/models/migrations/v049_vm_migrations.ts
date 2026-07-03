import type { Migration } from './migrationFramework';

/**
 * Migration v049 — vm_migrations 表
 *
 * 从 modules/containers/services/vmMigrationService.ensureTables() 下沉而来。
 * 虚拟机迁移任务记录表。
 */
const v049VmMigrations: Migration = {
  id: '20250101000049',
  version: 49,
  name: 'vm_migrations',
  description: 'VM migration task records table (migrated from vmMigrationService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vm_migrations (
        id TEXT PRIMARY KEY, vm_id TEXT NOT NULL, vm_name TEXT,
        source_host TEXT, target_host TEXT NOT NULL, platform_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending', progress INTEGER DEFAULT 0,
        reason TEXT, error_message TEXT,
        started_at TEXT, completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS vm_migrations`);
  },
};

export default v049VmMigrations;
