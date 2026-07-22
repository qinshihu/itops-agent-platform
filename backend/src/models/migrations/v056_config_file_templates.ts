/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v056 — config_file_templates 表
 *
 * 配置修复模板，从 configRepairService 运行时 CREATE TABLE 下沉而来。
 * 与 v022 config_templates 分离，避免 schema 冲突。
 */
const v056ConfigFileTemplates: Migration = {
  id: '20250101000056',
  version: 56,
  name: 'config_file_templates',
  description: 'Config file repair templates table (separate from v022 config_templates)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS config_file_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        parser TEXT NOT NULL,
        validator TEXT,
        reload_cmd TEXT,
        backup_dir TEXT NOT NULL,
        description TEXT,
        is_preset INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS config_file_templates;`);
  },
};

export default v056ConfigFileTemplates;
