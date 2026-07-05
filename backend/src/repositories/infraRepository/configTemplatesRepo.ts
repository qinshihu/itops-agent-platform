import db from '../../models/database';
import crypto from 'crypto';
import type {
  ConfigTemplateRecord, ConfigTemplateCreateInput, ConfigTemplateUpdateInput,
  ConfigTemplateListFilters, ConfigTemplateApplyResult,
  ConfigTemplateFullCreateInput, ConfigTemplateFullUpdateInput, ConfigTemplateFullListFilters,
} from './types';

export const configTemplatesRepo = {
  list(filters: ConfigTemplateListFilters = {}): { data: ConfigTemplateRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (filters.type) { where += ' AND type = ?'; params.push(filters.type); }
    if (filters.target_type) { where += ' AND target_type = ?'; params.push(filters.target_type); }
    if (filters.search) {
      where += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const total =
      (db.prepare(`SELECT COUNT(*) as count FROM config_templates ${where}`).get(...params) as { count: number })
        .count || 0;
    const data = db.prepare(
      `SELECT * FROM config_templates ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`
    ).all(...params, filters.pageSize ?? 20, filters.offset ?? 0) as ConfigTemplateRecord[];

    return { data, total };
  },

  getById(id: string): ConfigTemplateRecord | undefined {
    return db.prepare('SELECT * FROM config_templates WHERE id = ?').get(id) as ConfigTemplateRecord | undefined;
  },

  create(input: ConfigTemplateCreateInput): void {
    db.prepare(
      `INSERT INTO config_templates (id, name, description, type, content, variables, target_type, tags, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id,
      input.name,
      input.description,
      input.type,
      input.content,
      JSON.stringify(input.variables),
      input.target_type,
      JSON.stringify(input.tags),
      input.created_by
    );
  },

  update(id: string, input: ConfigTemplateUpdateInput): void {
    db.prepare(
      `UPDATE config_templates
       SET name=?, description=?, type=?, content=?, variables=?, target_type=?, tags=?, version=version+1, updated_at=datetime('now','localtime')
       WHERE id=?`
    ).run(
      input.name,
      input.description,
      input.type,
      input.content,
      JSON.stringify(input.variables),
      input.target_type,
      JSON.stringify(input.tags),
      id
    );
  },

  delete(id: string): number {
    const result = db.prepare('DELETE FROM config_templates WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },

  /**
   * 应用模板到目标：查找模板并创建应用任务。
   * 返回 { taskId, targetIds }；模板不存在时返回 undefined。
   */
  apply(id: string, targetIds: string[]): ConfigTemplateApplyResult | undefined {
    const tmpl = this.getById(id);
    if (!tmpl) return undefined;

    const taskId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO tasks (id, name, status, workflow_id, created_at, updated_at)
       VALUES (?, ?, 'pending', ?, datetime('now','localtime'), datetime('now','localtime'))`
    ).run(taskId, `应用模板: ${tmpl.name}`, tmpl.id);

    return { taskId, targetIds };
  },

  // ── 完整 schema 方法（v022 迁移，供 configTemplateService 使用）──

  createFull(input: ConfigTemplateFullCreateInput): void {
    db.prepare(`
      INSERT INTO config_templates (
        id, name, description, category, service_name, template_content,
        variables, os_type, target_path, backup_before_apply,
        restart_command, validation_command, is_system,
        usage_count, success_count, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @category, @service_name, @template_content,
        @variables, @os_type, @target_path, @backup_before_apply,
        @restart_command, @validation_command, @is_system,
        0, 0, @created_at, @updated_at
      )
    `).run(input);
  },

  getByIdOrThrow(id: string): ConfigTemplateRecord {
    const template = db.prepare('SELECT * FROM config_templates WHERE id = ?').get(id) as ConfigTemplateRecord | undefined;
    if (!template) {
      throw new Error(`Config template not found: ${id}`);
    }
    return template;
  },

  updateFull(id: string, updates: ConfigTemplateFullUpdateInput): void {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id, updated_at: now };

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', category: 'category',
      service_name: 'service_name', template_content: 'template_content',
      variables: 'variables', os_type: 'os_type', target_path: 'target_path',
      backup_before_apply: 'backup_before_apply', restart_command: 'restart_command',
      validation_command: 'validation_command', is_system: 'is_system',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in updates) {
        fields.push(`${dbField} = @${key}`);
        params[key] = (updates as Record<string, unknown>)[key];
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE config_templates SET ${fields.join(', ')} WHERE id = @id`;
    db.prepare(sql).run(params);
  },

  deleteFull(id: string): void {
    db.prepare('DELETE FROM config_templates WHERE id = ?').run(id);
  },

  listFull(filters: ConfigTemplateFullListFilters = {}): { templates: ConfigTemplateRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.category) { where += ' AND category = ?'; params.push(filters.category); }
    if (filters.service_name) { where += ' AND service_name = ?'; params.push(filters.service_name); }
    if (filters.os_type) { where += ' AND os_type = ?'; params.push(filters.os_type); }
    if (filters.is_system !== undefined) { where += ' AND is_system = ?'; params.push(filters.is_system); }

    const total =
      (db.prepare(`SELECT COUNT(*) as count FROM config_templates ${where}`).get(...params) as { count: number }).count;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const templates = db.prepare(
      `SELECT * FROM config_templates ${where} ORDER BY category, service_name, created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset) as ConfigTemplateRecord[];

    return { templates, total };
  },

  incrementUsage(id: string, success: boolean, updatedAt: string): void {
    db.prepare(`
      UPDATE config_templates
      SET usage_count = usage_count + 1,
          success_count = success_count + CASE WHEN ? THEN 1 ELSE 0 END,
          updated_at = ?
      WHERE id = ?
    `).run(success ? 1 : 0, updatedAt, id);
  },

  getCategories(): string[] {
    const result = db.prepare('SELECT DISTINCT category FROM config_templates ORDER BY category').all() as Array<{ category: string }>;
    return result.map(r => r.category);
  },

  getServiceNames(): string[] {
    const result = db.prepare('SELECT DISTINCT service_name FROM config_templates ORDER BY service_name').all() as Array<{ service_name: string }>;
    return result.map(r => r.service_name);
  },
};