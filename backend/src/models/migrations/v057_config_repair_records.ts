/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v057 — config_repair_records 表
 *
 * 从 configRepairService 运行时 CREATE TABLE 下沉而来。
 */
const v057ConfigRepairRecords: Migration = {
  id: '20250101000057',
  version: 57,
  name: 'config_repair_records',
  description: 'Config repair records table (migrated from configRepairService runtime CREATE TABLE)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS config_repair_records (
        id TEXT PRIMARY KEY,
        config_path TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_ip TEXT NOT NULL,
        repair_plan TEXT NOT NULL,
        status TEXT NOT NULL,
        backup_id TEXT,
        execution_result TEXT,
        error_message TEXT,
        approver TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS config_repair_records;`);
  },
};

export default v057ConfigRepairRecords;
