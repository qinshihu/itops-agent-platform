import db from '../../models/database';
import type { ReportScheduleRecord, ReportScheduleCreateInput, ReportScheduleUpdateInput } from './types';

export const reportSchedulesRepo = {
  list(): ReportScheduleRecord[] {
    return db.prepare('SELECT * FROM report_schedules ORDER BY created_at DESC').all() as ReportScheduleRecord[];
  },

  getById(id: string): ReportScheduleRecord | undefined {
    return db.prepare('SELECT * FROM report_schedules WHERE id = ?').get(id) as ReportScheduleRecord | undefined;
  },

  create(input: ReportScheduleCreateInput): void {
    db.prepare(`
      INSERT INTO report_schedules (id, name, template_id, cron_expression, enabled, recipients, format, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.name, input.template_id, input.cron_expression, input.enabled, input.recipients, input.format, input.created_at, input.updated_at);
  },

  update(id: string, updates: ReportScheduleUpdateInput): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name); }
    if (updates.template_id !== undefined) { setClauses.push('template_id = ?'); values.push(updates.template_id); }
    if (updates.cron_expression !== undefined) { setClauses.push('cron_expression = ?'); values.push(updates.cron_expression); }
    if (updates.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(updates.enabled); }
    if (updates.recipients !== undefined) { setClauses.push('recipients = ?'); values.push(updates.recipients); }
    if (updates.format !== undefined) { setClauses.push('format = ?'); values.push(updates.format); }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString(), id);
    db.prepare(`UPDATE report_schedules SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: string): number {
    const result = db.prepare('DELETE FROM report_schedules WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },
};