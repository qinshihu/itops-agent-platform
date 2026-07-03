import type { Migration } from './migrationFramework';

/**
 * Migration v055 — vm_platforms / vm_audit_logs 表
 *
 * 从 models/presets/initVMManagement.ts 下沉而来。
 * 运行时 CREATE TABLE 残留清理：表结构统一由迁移框架管理。
 */
const v055VmManagementTables: Migration = {
  id: '20250101000055',
  version: 55,
  name: 'vm_management_tables',
  description: 'VM platforms and audit logs tables (migrated from initVMManagement runtime CREATE TABLE)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS vm_platforms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hypervisor_type TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER,
        username TEXT,
        encrypted_password TEXT,
        encrypted_password_iv TEXT,
        config TEXT,
        status TEXT NOT NULL DEFAULT 'inactive',
        last_connected TEXT,
        error_message TEXT,
        tags TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS vm_audit_logs (
        id TEXT PRIMARY KEY,
        platform_id TEXT NOT NULL,
        vm_id TEXT,
        vm_name TEXT,
        operation TEXT NOT NULL,
        user_id TEXT,
        username TEXT,
        parameters TEXT,
        result TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (platform_id) REFERENCES vm_platforms(id)
      )
    `);

    db.exec(`CREATE INDEX IF NOT EXISTS idx_vm_platforms_type ON vm_platforms(hypervisor_type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_vm_platforms_status ON vm_platforms(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_vm_audit_platform ON vm_audit_logs(platform_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_vm_audit_vm ON vm_audit_logs(vm_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_vm_audit_time ON vm_audit_logs(started_at DESC)`);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS vm_audit_logs`);
    db.exec(`DROP TABLE IF EXISTS vm_platforms`);
  },
};

export default v055VmManagementTables;
