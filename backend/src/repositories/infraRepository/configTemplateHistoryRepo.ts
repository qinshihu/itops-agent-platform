import db from '../../models/database';
import type {
  ConfigTemplateHistoryRecord, ConfigTemplateHistoryCreateInput, ConfigTemplateHistoryListFilters,
} from './types';

export const configTemplateHistoryRepo = {
  create(input: ConfigTemplateHistoryCreateInput): void {
    db.prepare(`
      INSERT INTO config_template_history (
        id, template_id, server_id, applied_by, variables_snapshot,
        status, applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.template_id, input.server_id,
      input.applied_by, input.variables_snapshot,
      input.status, input.applied_at
    );
  },

  updateStatus(id: string, status: string, backupPath: string | null, result: string, appliedAt: string): void {
    db.prepare(`
      UPDATE config_template_history
      SET status = ?, backup_path = ?, result = ?, applied_at = ?
      WHERE id = ?
    `).run(status, backupPath, result, appliedAt, id);
  },

  updateError(id: string, errorMessage: string, appliedAt: string): void {
    db.prepare(`
      UPDATE config_template_history
      SET status = 'failed', error_message = ?, applied_at = ?
      WHERE id = ?
    `).run(errorMessage, appliedAt, id);
  },

  getByIdOrThrow(id: string): ConfigTemplateHistoryRecord {
    const history = db.prepare('SELECT * FROM config_template_history WHERE id = ?').get(id) as ConfigTemplateHistoryRecord | undefined;
    if (!history) {
      throw new Error(`Config template history not found: ${id}`);
    }
    return history;
  },

  list(filters: ConfigTemplateHistoryListFilters = {}): { histories: ConfigTemplateHistoryRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.template_id) { where += ' AND template_id = ?'; params.push(filters.template_id); }
    if (filters.server_id) { where += ' AND server_id = ?'; params.push(filters.server_id); }
    if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }

    const total =
      (db.prepare(`SELECT COUNT(*) as count FROM config_template_history ${where}`).get(...params) as { count: number }).count;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const histories = db.prepare(
      `SELECT * FROM config_template_history ${where} ORDER BY applied_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as ConfigTemplateHistoryRecord[];

    return { histories, total };
  },
};