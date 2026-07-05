/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v043 — alert_processing_records 表
 *
 * 从 core/AlertProcessor.ensureTables() 下沉而来。
 * 统一告警处理引擎的处理记录表（策略决策与执行追踪）。
 */
const v043AlertProcessingRecords: Migration = {
  id: '20250101000043',
  version: 43,
  name: 'alert_processing_records',
  description: 'Unified alert processing records table (migrated from AlertProcessor.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_processing_records (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        strategy TEXT NOT NULL,
        decision_reason TEXT,
        execution_id TEXT,
        task_id TEXT,
        aars_log_id TEXT,
        remediation_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_proc_alert_id ON alert_processing_records(alert_id);
      CREATE INDEX IF NOT EXISTS idx_proc_status ON alert_processing_records(status);
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP INDEX IF EXISTS idx_proc_status`);
    db.exec(`DROP INDEX IF EXISTS idx_proc_alert_id`);
    db.exec(`DROP TABLE IF EXISTS alert_processing_records`);
  },
};

export default v043AlertProcessingRecords;
