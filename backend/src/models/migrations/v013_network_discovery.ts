import { Migration } from './migrationFramework';

/**
 * v013 — 网络设备主动发现（IP 扫描）
 *
 * 表结构:
 * - network_discovery_jobs: 扫描任务记录
 * - network_discovery_results: 扫描结果（每个 IP 一条）
 */
const migration: Migration = {
  version: 13,
  id: '20240101000013',
  name: 'Network device discovery (IP scan)',
  description: 'Tables for active IP range scan and SNMP-based device discovery',
  async up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS network_discovery_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_ip TEXT NOT NULL,
        end_ip TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        progress INTEGER DEFAULT 0,
        total_hosts INTEGER DEFAULT 0,
        scanned_hosts INTEGER DEFAULT 0,
        found_devices INTEGER DEFAULT 0,
        credential_ids TEXT DEFAULT '[]',
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS network_discovery_results (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'offline'
          CHECK (status IN ('offline', 'online', 'snmp_ok', 'snmp_fail')),
        sys_name TEXT,
        sys_descr TEXT,
        sys_location TEXT,
        sys_object_id TEXT,
        snmp_version TEXT,
        community TEXT,
        interface_count INTEGER,
        vendor TEXT,
        model TEXT,
        response_time_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_discovery_results_job ON network_discovery_results(job_id, status);
      CREATE INDEX IF NOT EXISTS idx_discovery_results_ip ON network_discovery_results(ip_address);
      CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON network_discovery_jobs(status);
    `);
  },
  async down(db) {
    db.exec(`
      DROP TABLE IF EXISTS network_discovery_results;
      DROP TABLE IF EXISTS network_discovery_jobs;
    `);
  },
};

export default migration;
