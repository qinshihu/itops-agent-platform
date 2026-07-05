/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v053 — escalation_history 表
 *
 * 从 alerts/alertAutoResponse/adaptive/escalationEngine.ensureTable() 下沉而来。
 * 渐进式升级追踪历史记录表。
 */
const v053EscalationHistory: Migration = {
  id: '20250101000053',
  version: 53,
  name: 'escalation_history',
  description: 'Escalation engine history table (migrated from escalationEngine.ensureTable)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS escalation_history (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        entered_at TEXT NOT NULL,
        reason TEXT,
        notified INTEGER DEFAULT 0,
        resolved_at TEXT,
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS escalation_history`);
  },
};

export default v053EscalationHistory;
