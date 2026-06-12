import db from '../models/database';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

export interface ChangeInput {
  server_id: string;
  change_type: string;
  description?: string;
  changed_by?: string;
  status?: string;
  related_alert_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ChangeFilters {
  server_id?: string;
  change_type?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ChangeRecord {
  id: string;
  server_id: string;
  change_type: string;
  description: string | null;
  changed_by: string | null;
  status: string;
  related_alert_id: string | null;
  is_root_cause: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ChangeRecordDB {
  id: string;
  server_id: string;
  change_type: string;
  description: string | null;
  changed_by: string | null;
  status: string;
  related_alert_id: string | null;
  is_root_cause: number;
  metadata: string | null;
  created_at: string;
}

class ChangeService {
  create(input: ChangeInput): ChangeRecord {
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO change_records (id, server_id, change_type, description, changed_by, status, related_alert_id, is_root_cause, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      id,
      input.server_id,
      input.change_type,
      input.description || null,
      input.changed_by || null,
      input.status || 'completed',
      input.related_alert_id || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now
    );

    return this.getById(id)!;
  }

  list(filters: ChangeFilters = {}): { records: ChangeRecord[]; total: number; page: number; limit: number } {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM change_records WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM change_records WHERE 1=1';
    const params: unknown[] = [];

    if (filters.server_id) {
      query += ' AND server_id = ?';
      countQuery += ' AND server_id = ?';
      params.push(filters.server_id);
    }

    if (filters.change_type) {
      query += ' AND change_type = ?';
      countQuery += ' AND change_type = ?';
      params.push(filters.change_type);
    }

    if (filters.status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const records = db.prepare(query).all(...params, limit, offset) as ChangeRecordDB[];
    const totalResult = db.prepare(countQuery).get(...params) as { total: number };

    return {
      records: records.map(r => this.dbToChangeRecord(r)),
      total: totalResult.total,
      page,
      limit,
    };
  }

  get(id: string): ChangeRecord | null {
    return this.getById(id);
  }

  update(id: string, input: Partial<ChangeInput> & { status?: string; related_alert_id?: string }): ChangeRecord | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (input.change_type !== undefined) {
      fields.push('change_type = ?');
      params.push(input.change_type);
    }

    if (input.description !== undefined) {
      fields.push('description = ?');
      params.push(input.description || null);
    }

    if (input.changed_by !== undefined) {
      fields.push('changed_by = ?');
      params.push(input.changed_by || null);
    }

    if (input.status !== undefined) {
      fields.push('status = ?');
      params.push(input.status);
    }

    if (input.related_alert_id !== undefined) {
      fields.push('related_alert_id = ?');
      params.push(input.related_alert_id || null);
    }

    if (input.metadata !== undefined) {
      fields.push('metadata = ?');
      params.push(input.metadata ? JSON.stringify(input.metadata) : null);
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push('updated_at = datetime(\'now\',\'localtime\')');
    params.push(id);

    db.prepare(`
      UPDATE change_records SET ${fields.join(', ')} WHERE id = ?
    `).run(...params);

    return this.getById(id)!;
  }

  markAsRootCause(id: string): ChangeRecord | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    db.prepare(`
      UPDATE change_records SET is_root_cause = 1, updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id);

    return this.getById(id)!;
  }

  getRecentByServer(serverId: string, hours: number = 24): ChangeRecord[] {
    const records = db.prepare(`
      SELECT * FROM change_records 
      WHERE server_id = ? 
      AND created_at >= datetime('now', ?)
      ORDER BY created_at DESC
    `).all(serverId, `-${hours} hours`) as ChangeRecordDB[];

    return records.map(r => this.dbToChangeRecord(r));
  }

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM change_records WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private getById(id: string): ChangeRecord | null {
    const record = db.prepare('SELECT * FROM change_records WHERE id = ?').get(id) as ChangeRecordDB | undefined;
    if (!record) return null;
    return this.dbToChangeRecord(record);
  }

  private dbToChangeRecord(db: ChangeRecordDB): ChangeRecord {
    return {
      id: db.id,
      server_id: db.server_id,
      change_type: db.change_type,
      description: db.description,
      changed_by: db.changed_by,
      status: db.status,
      related_alert_id: db.related_alert_id,
      is_root_cause: Boolean(db.is_root_cause),
      metadata: db.metadata ? JSON.parse(db.metadata) : null,
      created_at: db.created_at,
    };
  }
}

export const changeService = new ChangeService();
