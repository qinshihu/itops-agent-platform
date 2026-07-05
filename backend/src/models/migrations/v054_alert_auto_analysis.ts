/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v054 — alert_auto_analysis 表
 *
 * 从 alerts/alertAutoAnalyzer.ensureTable() 下沉而来。
 * 告警自动分析结果持久化表 + 索引。
 */
const v054AlertAutoAnalysis: Migration = {
  id: '20250101000054',
  version: 54,
  name: 'alert_auto_analysis',
  description: 'Alert auto-analyzer results table (migrated from alertAutoAnalyzer.ensureTable)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_auto_analysis (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_ip TEXT NOT NULL,
        device_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        diagnosis TEXT,
        summary TEXT,
        raw_output TEXT,
        commands_executed TEXT,
        error_message TEXT,
        duration_ms INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_analysis_alert ON alert_auto_analysis(alert_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_analysis_status ON alert_auto_analysis(status)`);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS alert_auto_analysis`);
  },
};

export default v054AlertAutoAnalysis;
