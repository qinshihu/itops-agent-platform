import type { Migration } from './migrationFramework';

/**
 * Migration v044 — compose_projects 表
 *
 * 从 modules/infra/services/composeService.ensureTables() 下沉而来。
 * Docker Compose 项目持久化表。
 */
const v044ComposeProjects: Migration = {
  id: '20250101000044',
  version: 44,
  name: 'compose_projects',
  description: 'Docker Compose projects table (migrated from composeService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS compose_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        compose_content TEXT NOT NULL,
        status TEXT DEFAULT 'stopped',
        service_count INTEGER DEFAULT 0,
        running_count INTEGER DEFAULT 0,
        working_dir TEXT,
        tags TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS compose_projects`);
  },
};

export default v044ComposeProjects;
