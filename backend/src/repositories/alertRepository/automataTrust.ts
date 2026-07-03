import db from '../../models/database';

export interface AutomataTrustRecord {
  operation_key: string;
  approval_count: number;
  rejection_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;
  last_updated: string;
}

export const automataTrustRepo = {
  ensureTable(): void {
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS automata_trust (
        operation_key TEXT PRIMARY KEY,
        approval_count INTEGER DEFAULT 0,
        rejection_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0.5,
        last_updated TEXT
      )`);
    } catch { /* ignore */ }
  },

  listAll(): AutomataTrustRecord[] {
    return db.prepare('SELECT * FROM automata_trust').all() as AutomataTrustRecord[];
  },

  upsert(key: string, record: {
    approvalCount: number;
    rejectionCount: number;
    successCount: number;
    failureCount: number;
    successRate: number;
  }): void {
    db.prepare(`
      INSERT INTO automata_trust (operation_key, approval_count, rejection_count, success_count, failure_count, success_rate, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      ON CONFLICT(operation_key) DO UPDATE SET
        approval_count = excluded.approval_count,
        rejection_count = excluded.rejection_count,
        success_count = excluded.success_count,
        failure_count = excluded.failure_count,
        success_rate = excluded.success_rate,
        last_updated = datetime('now','localtime')
    `).run(key, record.approvalCount, record.rejectionCount, record.successCount, record.failureCount, record.successRate);
  },
};
