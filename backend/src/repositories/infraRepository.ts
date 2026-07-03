/**
 * infraRepository — infra 域基础设施表的统一数据访问层
 *
 * 采用 workflowRepository 的子 repository 聚合模式：
 *   - toolLinksRepo        (tool_links)
 *   - scriptsRepo          (scripts)
 *   - notificationsRepo    (notifications)
 *   - configTemplatesRepo  (config_templates)
 *   - approvalsRepo        (approval_requests)
 *
 * 取代 infra/routes 下 toolLinkRoutes / scriptRoutes / notificationRoutes /
 * configTemplateRoutes / approvalRoutes 等散落的 db.prepare 调用。
 *
 * 表结构：
 *   tool_links: id, name, url, description, category, icon, created_at, updated_at
 *   scripts: id, name, description, type, content, parameters(JSON string),
 *            category, version, created_at, updated_at
 *   notifications: id, type, title, content, recipient, status,
 *                  related_alert_id, related_task_id, created_at
 *   config_templates: id, name, description, type, content, variables(JSON),
 *                     target_type, tags(JSON), version, created_by, created_at, updated_at
 *   approval_requests: id, task_id, node_id, node_label, description, status,
 *                      requested_by, approved_by, approved_at, reject_reason,
 *                      timeout_at, timeout_action, created_at, updated_at
 */

import db from '../models/database';
import crypto from 'crypto';
import type { ApprovalRequest } from '../types';

// ── tool_links 表类型 ──

export interface ToolLinkRecord {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
  icon?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ToolLinkCreateInput {
  id: string;
  name: string;
  url: string;
  description?: string | null;
  category?: string | null;
}

export interface ToolLinkUpdateInput {
  name?: string;
  url?: string;
  description?: string | null;
  category?: string | null;
}

// ── scripts 表类型 ──

export interface ScriptRecordRaw {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: string | null;
  category?: string | null;
  version: number;
  created_at: string;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ScriptRecord extends Omit<ScriptRecordRaw, 'parameters'> {
  parameters: unknown[];
}

export interface ScriptCreateInput {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: unknown;
  category?: string | null;
}

export interface ScriptUpdateInput {
  name: string;
  description?: string | null;
  type: string;
  content: string;
  parameters?: unknown;
  category?: string | null;
}

export interface ScriptListFilters {
  category?: string;
  search?: string;
}

// ── notifications 表类型 ──

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  recipient?: string | null;
  status: string;
  related_alert_id?: string | null;
  related_task_id?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface NotificationCreateInput {
  id: string;
  type: string;
  title: string;
  content?: string | null;
  recipient?: string | null;
  status: string;
  related_alert_id?: string | null;
  related_task_id?: string | null;
  created_at: string;
}

export interface NotificationListFilters {
  type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  typeStats: Array<{ type: string; status: string; count: number }>;
  pendingCount: number;
  todaySent: number;
}

// ── config_templates 表类型 ──

export interface ConfigTemplateRecord {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  variables?: string | null;
  target_type: string;
  tags?: string | null;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ConfigTemplateCreateInput {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  variables: unknown;
  target_type: string;
  tags: unknown;
  created_by: string;
}

export interface ConfigTemplateUpdateInput {
  name: string;
  description: string;
  type: string;
  content: string;
  variables: unknown;
  target_type: string;
  tags: unknown;
}

export interface ConfigTemplateListFilters {
  type?: string;
  target_type?: string;
  search?: string;
  pageSize?: number;
  offset?: number;
}

export interface ConfigTemplateApplyResult {
  taskId: string;
  targetIds: string[];
}

// ── approval_requests 表类型 ──

export interface ApprovalListFilters {
  status?: string;
  limit?: number;
}

// ── tool_links 子 repository ──

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

// ── scripts 子 repository ──

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

// ── notifications 子 repository ──

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

// ── config_templates 子 repository ──

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
   * 保留原 configTemplateRoutes.ts apply 端点的 tasks INSERT 语义
   * （显式写入 created_at/updated_at）。
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
};

// ── approval_requests 子 repository ──

export const approvalsRepo = {
  list(filters: ApprovalListFilters = {}): ApprovalRequest[] {
    let query = 'SELECT * FROM approval_requests';
    const params: unknown[] = [];

    if (filters.status) {
      query += ' WHERE status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params) as ApprovalRequest[];
  },

  countPending(): number {
    const result = db
      .prepare("SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'")
      .get() as { count: number };
    return result.count;
  },

  getById(id: string): ApprovalRequest | undefined {
    return db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as ApprovalRequest | undefined;
  },

  /** 创建审批请求 */
  create(input: {
    id: string;
    task_id: string;
    node_id: string;
    node_label: string;
    description: string;
    timeout_at: string | null;
    timeout_action: string;
  }): void {
    db.prepare(`
      INSERT INTO approval_requests (id, task_id, node_id, node_label, description, status, timeout_at, timeout_action)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(input.id, input.task_id, input.node_id, input.node_label, input.description, input.timeout_at, input.timeout_action);
  },

  /** 审批通过 */
  approve(id: string, approvedBy: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'approved', approved_by = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(approvedBy, id);
  },

  /** 审批拒绝 */
  reject(id: string, rejectedBy: string, reason: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'rejected', approved_by = ?, reject_reason = ?, approved_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(rejectedBy, reason, id);
  },

  /** 审批超时 */
  timeout(id: string): void {
    db.prepare(`
      UPDATE approval_requests
      SET status = 'timeout', updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },
};

// ── 聚合导出 ──

export const infraRepository = {
  toolLinks: toolLinksRepo,
  scripts: scriptsRepo,
  notifications: notificationsRepo,
  configTemplates: configTemplatesRepo,
  approvals: approvalsRepo,
};
