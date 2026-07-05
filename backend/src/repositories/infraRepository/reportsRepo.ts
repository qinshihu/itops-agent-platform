import db from '../../models/database';
import type { ReportRecord, ReportCreateInput, ReportUpdateInput } from './types';

export const reportsRepo = {
  countPresetTemplates(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM reports WHERE is_preset = 1 AND type = 'template'").get() as { count: number };
    return row.count;
  },

  listTemplates(): ReportRecord[] {
    return db.prepare("SELECT * FROM reports WHERE type = 'template' ORDER BY is_preset DESC, created_at DESC").all() as ReportRecord[];
  },

  getTemplateById(id: string): ReportRecord | undefined {
    return db.prepare("SELECT * FROM reports WHERE id = ? AND type = 'template'").get(id) as ReportRecord | undefined;
  },

  create(input: ReportCreateInput): void {
    db.prepare(`
      INSERT INTO reports (id, name, type, content, format, task_id, variables, metadata, is_preset, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.type,
      input.content ?? null, input.format ?? null,
      input.task_id ?? null,
      input.variables ?? null, input.metadata ?? null,
      input.is_preset ?? 0, input.created_at, input.updated_at ?? input.created_at
    );
  },

  getById(id: string): ReportRecord | undefined {
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as ReportRecord | undefined;
  },

  updateTemplate(id: string, updates: ReportUpdateInput): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name); }
    if (updates.content !== undefined) { setClauses.push('content = ?'); values.push(updates.content); }
    if (updates.variables !== undefined) { setClauses.push('variables = ?'); values.push(updates.variables); }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString(), id);
    db.prepare(`UPDATE reports SET ${setClauses.join(', ')} WHERE id = ? AND type = 'template'`).run(...values);
  },

  deleteTemplate(id: string): number {
    const result = db.prepare("DELETE FROM reports WHERE id = ? AND is_preset = 0 AND type = 'template'").run(id);
    return (result as { changes: number }).changes;
  },

  listGenerated(limit: number): ReportRecord[] {
    return db.prepare(`
      SELECT * FROM reports
      WHERE type IN ('generated', 'workflow')
      ORDER BY created_at DESC LIMIT ?
    `).all(limit) as ReportRecord[];
  },

  getGeneratedById(id: string): ReportRecord | undefined {
    return db.prepare("SELECT * FROM reports WHERE id = ? AND type IN ('generated', 'workflow')").get(id) as ReportRecord | undefined;
  },
};