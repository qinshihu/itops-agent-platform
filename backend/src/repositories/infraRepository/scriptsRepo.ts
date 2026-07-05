import db from '../../models/database';
import type { ScriptRecord, ScriptRecordRaw, ScriptCreateInput, ScriptUpdateInput, ScriptListFilters } from './types';

function processScript(script: ScriptRecordRaw): ScriptRecord {
  return {
    ...script,
    parameters: script.parameters ? JSON.parse(script.parameters) : [],
  };
}

export const scriptsRepo = {
  list(filters: ScriptListFilters = {}): ScriptRecord[] {
    let query = 'SELECT * FROM scripts WHERE 1=1';
    const params: unknown[] = [];

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    query += ' ORDER BY created_at DESC';

    const scripts = db.prepare(query).all(...params) as ScriptRecordRaw[];
    return scripts.map(processScript);
  },

  listCategories(): string[] {
    const categories = db.prepare(
      'SELECT DISTINCT category FROM scripts WHERE category IS NOT NULL'
    ).all() as Array<{ category: string }>;
    return categories.map((c) => c.category);
  },

  getById(id: string): ScriptRecord | undefined {
    const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as ScriptRecordRaw | undefined;
    if (!script) return undefined;
    return processScript(script);
  },

  /** 返回原始记录（parameters 仍为 JSON 字符串），供预设/初始化场景使用 */
  getByIdRaw(id: string): ScriptRecordRaw | undefined {
    return db.prepare('SELECT * FROM scripts WHERE id = ?').get(id) as ScriptRecordRaw | undefined;
  },

  create(input: ScriptCreateInput): void {
    db.prepare(
      `INSERT INTO scripts (id, name, description, type, content, parameters, category, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      input.id,
      input.name,
      input.description,
      input.type,
      input.content,
      input.parameters ? JSON.stringify(input.parameters) : null,
      input.category
    );
  },

  update(id: string, input: ScriptUpdateInput): void {
    db.prepare(
      `UPDATE scripts
       SET name = ?, description = ?, type = ?, content = ?,
           parameters = ?, category = ?, version = version + 1, updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      input.name,
      input.description,
      input.type,
      input.content,
      input.parameters ? JSON.stringify(input.parameters) : null,
      input.category,
      id
    );
  },

  delete(id: string): number {
    const result = db.prepare('DELETE FROM scripts WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },
};