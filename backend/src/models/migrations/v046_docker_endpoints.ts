/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v046 — docker_endpoints 表
 *
 * 从 modules/containers/services/multiHostDockerService.ensureTables() 下沉而来。
 * 多主机 Docker 端点配置表（不含运行时 loadEndpoints 逻辑，仅 schema）。
 */
const v046DockerEndpoints: Migration = {
  id: '20250101000046',
  version: 46,
  name: 'docker_endpoints',
  description: 'Multi-host Docker endpoints table (migrated from multiHostDockerService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS docker_endpoints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 2375,
        protocol TEXT DEFAULT 'socket',
        tls_ca TEXT,
        tls_cert TEXT,
        tls_key TEXT,
        status TEXT DEFAULT 'inactive',
        error_message TEXT,
        containers_running INTEGER DEFAULT 0,
        containers_total INTEGER DEFAULT 0,
        images INTEGER DEFAULT 0,
        cpu_count INTEGER DEFAULT 0,
        memory_limit INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS docker_endpoints`);
  },
};

export default v046DockerEndpoints;
