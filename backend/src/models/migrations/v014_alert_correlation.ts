import { Migration } from './migrationFramework';

/**
 * v014 — 告警关联聚合
 *
 * 表结构:
 * - alert_correlation_groups: 关联组
 * - alert_correlation_members: 组成员
 */
const migration: Migration = {
  version: 14,
  id: '20240101000014',
  name: 'Alert correlation/aggregation',
  description: 'Tables for grouping related alerts into correlation groups',
  async up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_correlation_groups (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'resolved', 'closed')),
        root_alert_id TEXT,
        root_cause TEXT,
        alert_count INTEGER DEFAULT 0,
        device_ids TEXT DEFAULT '',
        severity TEXT NOT NULL DEFAULT 'medium'
          CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        auto_detected INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS alert_correlation_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL REFERENCES alert_correlation_groups(id) ON DELETE CASCADE,
        alert_id TEXT NOT NULL,
        is_root INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(group_id, alert_id)
      );

      CREATE INDEX IF NOT EXISTS idx_corr_group_status ON alert_correlation_groups(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_corr_member_group ON alert_correlation_members(group_id);
      CREATE INDEX IF NOT EXISTS idx_corr_member_alert ON alert_correlation_members(alert_id);
    `);
  },
  async down(db) {
    db.exec(`
      DROP TABLE IF EXISTS alert_correlation_members;
      DROP TABLE IF EXISTS alert_correlation_groups;
    `);
  },
};

export default migration;
