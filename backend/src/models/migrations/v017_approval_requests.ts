/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

const v017ApprovalRequests: Migration = {
  id: '20260614000017',
  version: 17,
  name: 'approval_requests',
  description: 'Add approval_requests table for HITL workflow',
  
  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS approval_requests (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        node_label TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        requested_by TEXT,
        approved_by TEXT,
        approved_at DATETIME,
        reject_reason TEXT,
        timeout_at DATETIME,
        timeout_action TEXT DEFAULT 'reject',
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_approval_task ON approval_requests(task_id);
      CREATE INDEX IF NOT EXISTS idx_approval_status ON approval_requests(status);
      CREATE INDEX IF NOT EXISTS idx_approval_created ON approval_requests(created_at DESC);
    `);
  },
  
  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS approval_requests`);
  }
};

export default v017ApprovalRequests;
