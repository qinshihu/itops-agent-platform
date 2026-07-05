/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v045 — image_registries 表
 *
 * 从 modules/containers/services/registryService.ensureTables() 下沉而来。
 * 镜像仓库凭据与状态持久化表。
 */
const v045ImageRegistries: Migration = {
  id: '20250101000045',
  version: 45,
  name: 'image_registries',
  description: 'Image registry credentials table (migrated from registryService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS image_registries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        username TEXT,
        encrypted_password TEXT,
        encrypted_password_iv TEXT,
        status TEXT DEFAULT 'inactive',
        error_message TEXT,
        project_count INTEGER DEFAULT 0,
        repo_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS image_registries`);
  },
};

export default v045ImageRegistries;
