/**
 * vmMigrationRepository — vm_migrations 表数据访问层
 *
 * 覆盖表：vm_migrations (v049)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface VmMigrationRecord {
  id: string;
  vm_id: string;
  vm_name: string | null;
  source_host: string | null;
  target_host: string;
  platform_id: string;
  status: string;
  progress: number;
  reason: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface VmMigrationCreateInput {
  id: string;
  vm_id: string;
  vm_name?: string | null;
  source_host?: string | null;
  target_host: string;
  platform_id: string;
  status?: string;
  progress?: number;
  reason?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface VmMigrationListFilters {
  vm_id?: string;
  limit?: number;
}

// ── repository 实现 ──

export const vmMigrationRepository = {
  create(input: VmMigrationCreateInput): void {
    db.prepare(`
      INSERT INTO vm_migrations (
        id, vm_id, vm_name, source_host, target_host, platform_id,
        status, progress, reason, error_message, started_at, completed_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id,
      input.vm_id,
      input.vm_name ?? null,
      input.source_host ?? null,
      input.target_host,
      input.platform_id,
      input.status ?? 'pending',
      input.progress ?? 0,
      input.reason ?? null,
      input.error_message ?? null,
      input.started_at ?? null,
      input.completed_at ?? null,
    );
  },

  updateStatus(id: string, status: string, errorMessage?: string | null): void {
    if (errorMessage !== undefined) {
      db.prepare(`
        UPDATE vm_migrations SET status = ?, error_message = ?, completed_at = CASE WHEN ? IN ('completed','failed','cancelled') THEN datetime('now','localtime') ELSE completed_at END WHERE id = ?
      `).run(status, errorMessage ?? null, status, id);
    } else {
      db.prepare(`
        UPDATE vm_migrations SET status = ?, completed_at = CASE WHEN ? IN ('completed','failed','cancelled') THEN datetime('now','localtime') ELSE completed_at END WHERE id = ?
      `).run(status, status, id);
    }
  },

  updateProgress(id: string, progress: number): void {
    db.prepare('UPDATE vm_migrations SET progress = ? WHERE id = ?').run(progress, id);
  },

  getById(id: string): VmMigrationRecord | undefined {
    return db.prepare('SELECT * FROM vm_migrations WHERE id = ?').get(id) as VmMigrationRecord | undefined;
  },

  list(filters: VmMigrationListFilters = {}): { rows: VmMigrationRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.vm_id) {
      where += ' AND vm_id = ?';
      params.push(filters.vm_id);
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM vm_migrations ${where}`).get(...params) as { count: number })?.count || 0;

    const limit = filters.limit ?? 50;
    const rows = db.prepare(`SELECT * FROM vm_migrations ${where} ORDER BY created_at DESC LIMIT ?`).all(...params, limit) as VmMigrationRecord[];

    return { rows, total };
  },
};