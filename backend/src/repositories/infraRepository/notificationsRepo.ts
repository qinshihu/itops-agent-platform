import db from '../../models/database';
import type { NotificationRecord, NotificationCreateInput, NotificationListFilters, NotificationStats } from './types';

export const notificationsRepo = {
  list(filters: NotificationListFilters = {}): NotificationRecord[] {
    let query = 'SELECT * FROM notifications WHERE 1=1';
    const params: unknown[] = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(filters.limit ?? 50);
    params.push(filters.offset ?? 0);

    return db.prepare(query).all(...params) as NotificationRecord[];
  },

  count(filters: Omit<NotificationListFilters, 'limit' | 'offset'> = {}): number {
    let query = 'SELECT COUNT(*) as total FROM notifications WHERE 1=1';
    const params: unknown[] = [];

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.start_date) {
      query += ' AND created_at >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      query += ' AND created_at <= ?';
      params.push(filters.end_date);
    }

    return (db.prepare(query).get(...params) as { total: number }).total;
  },

  create(input: NotificationCreateInput): void {
    db.prepare(
      `INSERT INTO notifications (id, type, title, content, recipient, status, related_alert_id, related_task_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.type,
      input.title,
      input.content,
      input.recipient,
      input.status,
      input.related_alert_id,
      input.related_task_id,
      input.created_at
    );
  },

  getById(id: string): NotificationRecord | undefined {
    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRecord | undefined;
  },

  markSent(id: string): void {
    db.prepare(`UPDATE notifications SET status = 'sent', sent_at = datetime('now','localtime') WHERE id = ?`).run(id);
  },

  markFailed(id: string, errorMessage: string): void {
    db.prepare(`UPDATE notifications SET status = 'failed', error_message = ? WHERE id = ?`).run(errorMessage, id);
  },

  getHistory(limit = 50): NotificationRecord[] {
    return db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?').all(limit) as NotificationRecord[];
  },

  delete(id: string): number {
    const result = db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },

  getStats(): NotificationStats {
    const typeStats = db.prepare(
      `SELECT type, status, COUNT(*) as count
       FROM notifications
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY type, status`
    ).all() as Array<{ type: string; status: string; count: number }>;

    const pendingCount = (
      db.prepare(`SELECT COUNT(*) as count FROM notifications WHERE status = 'pending'`).get() as { count: number }
    ).count;

    const todaySent = (
      db.prepare(
        `SELECT COUNT(*) as count
         FROM notifications
         WHERE status = 'sent' AND created_at >= datetime('now', 'start of day')`
      ).get() as { count: number }
    ).count;

    return { typeStats, pendingCount, todaySent };
  },
};