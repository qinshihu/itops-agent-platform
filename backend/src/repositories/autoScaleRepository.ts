/**
 * autoScaleRepository — 自动伸缩规则与历史记录数据访问层
 *
 * 覆盖以下表：
 *   - auto_scale_rules    (v048)
 *   - auto_scale_history  (v048)
 */

import db from '../models/database';

// ── 类型定义 ──

export interface AutoScaleRuleRecord {
  id: string;
  name: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  metric_type: string;
  threshold: number;
  target_value: number;
  min_instances: number;
  max_instances: number;
  scale_up_cooldown: number;
  scale_down_cooldown: number;
  enabled: number;
  last_scale_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoScaleHistoryRecord {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  target_type: string | null;
  target_id: string | null;
  action: string | null;
  previous_count: number | null;
  current_count: number | null;
  metric_value: number | null;
  result: string | null;
  reason: string | null;
  timestamp: string;
}

export type AutoScaleRuleCreateInput = Omit<AutoScaleRuleRecord, 'last_scale_time' | 'created_at' | 'updated_at'>;

export interface AutoScaleHistoryCreateInput {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  target_type: string | null;
  target_id: string | null;
  action: string | null;
  previous_count: number | null;
  current_count: number | null;
  metric_value: number | null;
  result: string | null;
  reason: string | null;
}

export interface AutoScaleHistoryListFilters {
  rule_id?: string;
  action?: string;
  result?: string;
  page?: number;
  limit?: number;
}

// ── repository 实现 ──

export const autoScaleRepository = {
  // ═══ auto_scale_rules ═══

  listRules(): AutoScaleRuleRecord[] {
    return db.prepare('SELECT * FROM auto_scale_rules ORDER BY name').all() as AutoScaleRuleRecord[];
  },

  getRuleById(id: string): AutoScaleRuleRecord | undefined {
    return db.prepare('SELECT * FROM auto_scale_rules WHERE id = ?').get(id) as AutoScaleRuleRecord | undefined;
  },

  createRule(input: AutoScaleRuleCreateInput): void {
    db.prepare(`
      INSERT INTO auto_scale_rules (
        id, name, target_type, target_id, target_name,
        metric_type, threshold, target_value,
        min_instances, max_instances,
        scale_up_cooldown, scale_down_cooldown, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.target_type, input.target_id, input.target_name ?? null,
      input.metric_type, input.threshold, input.target_value,
      input.min_instances, input.max_instances,
      input.scale_up_cooldown, input.scale_down_cooldown, input.enabled
    );
  },

  updateRule(id: string, fields: Record<string, unknown>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && key !== 'id') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE auto_scale_rules SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  deleteRule(id: string): void {
    db.prepare('DELETE FROM auto_scale_rules WHERE id = ?').run(id);
  },

  updateLastScaleTime(id: string): void {
    db.prepare(`UPDATE auto_scale_rules SET last_scale_time = datetime('now','localtime') WHERE id = ?`).run(id);
  },

  countActiveRules(): number {
    const result = db.prepare('SELECT COUNT(*) as count FROM auto_scale_rules WHERE enabled = 1').get() as { count: number };
    return result?.count || 0;
  },

  sumMaxInstances(): number {
    const result = db.prepare('SELECT SUM(max_instances) as sum FROM auto_scale_rules WHERE enabled = 1').get() as { sum: number | null };
    return result?.sum || 0;
  },

  // ═══ auto_scale_history ═══

  createHistory(input: AutoScaleHistoryCreateInput): void {
    db.prepare(`
      INSERT INTO auto_scale_history (
        id, rule_id, rule_name, target_type, target_id,
        action, previous_count, current_count, metric_value,
        result, reason, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id, input.rule_id, input.rule_name, input.target_type, input.target_id,
      input.action, input.previous_count, input.current_count, input.metric_value,
      input.result, input.reason
    );
  },

  listHistory(filters: AutoScaleHistoryListFilters = {}): { rows: AutoScaleHistoryRecord[]; total: number } {
    let where = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.rule_id) { where += ' AND rule_id = ?'; params.push(filters.rule_id); }
    if (filters.action) { where += ' AND action = ?'; params.push(filters.action); }
    if (filters.result) { where += ' AND result = ?'; params.push(filters.result); }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM auto_scale_history ${where}`).get(...params) as { count: number })?.count || 0;

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const rows = db.prepare(`SELECT * FROM auto_scale_history ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as AutoScaleHistoryRecord[];

    return { rows, total };
  },

  countTodayByAction(action: string): number {
    const result = db.prepare("SELECT COUNT(*) as count FROM auto_scale_history WHERE action = ? AND date(timestamp) = date('now','localtime')").get(action) as { count: number };
    return result?.count || 0;
  },
};