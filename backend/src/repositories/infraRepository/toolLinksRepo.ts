import db from '../../models/database';
import type { ToolLinkRecord, ToolLinkCreateInput, ToolLinkUpdateInput } from './types';

export const toolLinksRepo = {
  list(): ToolLinkRecord[] {
    return db.prepare('SELECT * FROM tool_links ORDER BY name ASC').all() as ToolLinkRecord[];
  },

  getById(id: string): ToolLinkRecord | undefined {
    return db.prepare('SELECT * FROM tool_links WHERE id = ?').get(id) as ToolLinkRecord | undefined;
  },

  create(input: ToolLinkCreateInput): void {
    db.prepare(
      `INSERT INTO tool_links (id, name, url, description, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`
    ).run(input.id, input.name, input.url, input.description, input.category);
  },

  update(id: string, fields: ToolLinkUpdateInput): number {
    const updates: string[] = [];
    const values: unknown[] = [];
    if (fields.name !== undefined) { updates.push('name = ?'); values.push(fields.name); }
    if (fields.url !== undefined) { updates.push('url = ?'); values.push(fields.url); }
    if (fields.description !== undefined) { updates.push('description = ?'); values.push(fields.description); }
    if (fields.category !== undefined) { updates.push('category = ?'); values.push(fields.category); }
    if (updates.length === 0) return 0;
    updates.push("updated_at = datetime('now', 'localtime')");
    values.push(id);
    const result = db.prepare(`UPDATE tool_links SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return (result as { changes: number }).changes;
  },

  delete(id: string): number {
    const result = db.prepare('DELETE FROM tool_links WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },

  updateIcon(id: string, iconPath: string): void {
    db.prepare(
      `UPDATE tool_links SET icon = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(iconPath, id);
  },
};