import { Migration } from './migrationFramework';

/**
 * v015: Add missing columns to notifications table
 *
 * The notifications table was missing columns that notificationService.ts
 * references: related_alert_id, related_task_id, sent_at, error_message.
 * This caused silent failures when sending notifications via WeCom/DingTalk.
 */
const migration: Migration = {
  version: 15,
  id: '20250101000015',
  name: 'Add missing notification columns',
  description: 'Adds related_alert_id, related_task_id, sent_at, error_message columns to notifications table',
  up: async (db: any) => {
    // Safely add each column if it doesn't exist
    const existingColumns = db.prepare("PRAGMA table_info('notifications')").all() as Array<{ name: string }>;
    const columnNames = existingColumns.map((c: { name: string }) => c.name);

    const addColumn = (col: string, def: string) => {
      if (!columnNames.includes(col)) {
        db.prepare(`ALTER TABLE notifications ADD COLUMN ${col} ${def}`).run();
      }
    };

    addColumn('related_alert_id', 'TEXT');
    addColumn('related_task_id', 'TEXT');
    addColumn('sent_at', 'DATETIME');
    addColumn('error_message', 'TEXT');
  },
  down: async (_db: any) => {
    // SQLite does not support DROP COLUMN in older versions (pre-3.35.0)
    // Best we can do is recreate, but skip for simplicity
  }
};

export default migration;
