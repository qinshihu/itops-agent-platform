// ── workflowMappings 子 repository ──

import db from '../../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AlertWorkflowMapping } from '../types/alert';
import type {
  AlertWorkflowMappingCreateInput,
  AlertWorkflowMappingRecord,
  AlertWorkflowMappingUpdateInput,
} from './types';

export const workflowMappingsRepo = {
  /**
   * 列出告警-工作流映射（JOIN workflows 获取 workflow_name）
   * 对应：alertMappingRoutes LIST
   */
  list(): Array<AlertWorkflowMappingRecord & { workflow_name?: string }> {
    return db.prepare(`
      SELECT am.*, w.name as workflow_name
      FROM alert_workflow_mappings am
      LEFT JOIN workflows w ON am.workflow_id = w.id
      ORDER BY am.created_at DESC
    `).all() as Array<AlertWorkflowMappingRecord & { workflow_name?: string }>;
  },

  /**
   * 按 ID 查询映射（JOIN workflows 获取 workflow_name）
   * 对应：alertMappingRoutes GET /:id
   */
  getById(id: string): (AlertWorkflowMappingRecord & { workflow_name?: string }) | undefined {
    return db.prepare(`
      SELECT am.*, w.name as workflow_name
      FROM alert_workflow_mappings am
      LEFT JOIN workflows w ON am.workflow_id = w.id
      WHERE am.id = ?
    `).get(id) as (AlertWorkflowMappingRecord & { workflow_name?: string }) | undefined;
  },

  /**
   * 创建映射（无 updated_at 列）
   * 对应：alertMappingRoutes POST /
   */
  create(input: AlertWorkflowMappingCreateInput): void {
    db.prepare(`
      INSERT INTO alert_workflow_mappings (id, alert_source, alert_severity, alert_title_pattern, workflow_id, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.alert_source ?? null, input.alert_severity ?? null, input.alert_title_pattern ?? null, input.workflow_id, input.enabled);
  },

  /**
   * 更新映射（动态 SET，无 updated_at 列）
   * 对应：alertMappingRoutes PUT /:id
   */
  update(id: string, fields: AlertWorkflowMappingUpdateInput): number {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (fields.alert_source !== undefined) { sets.push('alert_source = ?'); params.push(fields.alert_source); }
    if (fields.alert_severity !== undefined) { sets.push('alert_severity = ?'); params.push(fields.alert_severity); }
    if (fields.alert_title_pattern !== undefined) { sets.push('alert_title_pattern = ?'); params.push(fields.alert_title_pattern); }
    if (fields.workflow_id !== undefined) { sets.push('workflow_id = ?'); params.push(fields.workflow_id); }
    if (fields.enabled !== undefined) { sets.push('enabled = ?'); params.push(fields.enabled); }

    if (sets.length === 0) return 0;

    params.push(id);
    return db.prepare(`UPDATE alert_workflow_mappings SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes;
  },

  /**
   * 删除映射
   * 对应：alertMappingRoutes DELETE /:id
   */
  delete(id: string): number {
    return db.prepare('DELETE FROM alert_workflow_mappings WHERE id = ?').run(id).changes;
  },

  /**
   * 查找匹配的启用映射（按 source 精确度排序）
   * 对应：alertWorkflowMappingService.triggerFirstMatchingWorkflow
   */
  findMatching(source: string): AlertWorkflowMappingRecord[] {
    return db.prepare(`
      SELECT * FROM alert_workflow_mappings
      WHERE enabled = 1
      ORDER BY CASE WHEN alert_source = ? THEN 0 ELSE 1 END, CASE WHEN alert_source = '*' THEN 2 ELSE 3 END
    `).all(source) as AlertWorkflowMappingRecord[];
  },
};