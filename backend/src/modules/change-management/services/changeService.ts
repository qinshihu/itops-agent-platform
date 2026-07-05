import { changeRepository } from '../../../repositories';
import { randomUUID } from 'crypto';

export interface ChangeInput {
  server_id: string;
  change_type: string;
  description?: string;
  changed_by?: string;
  status?: string;
  related_alert_id?: string;
  metadata?: Record<string, string>;
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
  metadata: Record<string, string> | null;
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

    changeRepository.create({
      id,
      server_id: input.server_id,
      change_type: input.change_type,
      description: input.description || null,
      changed_by: input.changed_by || null,
      status: input.status || 'completed',
      related_alert_id: input.related_alert_id || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      created_at: now,
    });

    return this.getById(id)!;
  }

  list(filters: ChangeFilters = {}): { records: ChangeRecord[]; total: number; page: number; limit: number } {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const { records, total } = changeRepository.list({
      server_id: filters.server_id,
      change_type: filters.change_type,
      status: filters.status,
      limit,
      offset,
    });

    return {
      records: records.map(r => this.dbToChangeRecord(r)),
      total,
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

    changeRepository.update(id, {
      change_type: input.change_type,
      description: input.description,
      changed_by: input.changed_by,
      status: input.status,
      related_alert_id: input.related_alert_id,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    });

    return this.getById(id)!;
  }

  markAsRootCause(id: string): ChangeRecord | null {
    const existing = this.getById(id);
    if (!existing) {
      return null;
    }

    changeRepository.markAsRootCause(id);

    return this.getById(id)!;
  }

  getRecentByServer(serverId: string, hours = 24): ChangeRecord[] {
    const records = changeRepository.getRecentByServer(serverId, hours) as ChangeRecordDB[];

    return records.map(r => this.dbToChangeRecord(r));
  }

  delete(id: string): boolean {
    return changeRepository.delete(id);
  }

  private getById(id: string): ChangeRecord | null {
    const record = changeRepository.getById(id) as ChangeRecordDB | undefined;
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
