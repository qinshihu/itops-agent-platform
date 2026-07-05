/**
 * configRepairRecordsRepo — config_repair_records 表的数据访问层
 *
 * 覆盖 configRepairService.ts 中直接 db.prepare 调用，包括：
 *   - getById / list / create / updateStatus
 */

import db from '../../../models/database';

// ── 类型定义 ──

export interface ConfigRepairRecord {
  id: string;
  config_path: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  repair_plan: string;
  status: string;
  backup_id: string | null;
  execution_result: string | null;
  error_message: string | null;
  approver: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigRepairCreateInput {
  id: string;
  config_path: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  repair_plan: string;
  status: string;
  backup_id: string | null;
  approver: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfigRepairListFilters {
  device_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// ── repository 实现 ──

export const configRepairRecordsRepo = {
  /** 按 ID 查询 */
  getById(id: string): ConfigRepairRecord | undefined {
    return db.prepare('SELECT * FROM config_repair_records WHERE id = ?').get(id) as ConfigRepairRecord | undefined;
  },

  /** 检查是否存在 */
  exists(id: string): boolean {
    const row = db.prepare('SELECT id FROM config_repair_records WHERE id = ?').get(id);
    return !!row;
  },

  /** 列表查询（分页） */
  list(filters: ConfigRepairListFilters = {}): ConfigRepairRecord[] {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.device_id) { conditions.push('device_id = ?'); params.push(filters.device_id); }
    if (filters.status) { conditions.push('status = ?'); params.push(filters.status); }

    let sql = `SELECT * FROM config_repair_records WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    if (filters.limit !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, filters.offset ?? 0);
    }

    return db.prepare(sql).all(...params) as ConfigRepairRecord[];
  },

  /** 创建修复记录 */
  create(input: ConfigRepairCreateInput): void {
    db.prepare(`
      INSERT INTO config_repair_records (id, config_path, device_id, device_name, device_ip, repair_plan, status, backup_id, approver, approved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.config_path, input.device_id, input.device_name, input.device_ip,
      input.repair_plan, input.status, input.backup_id, input.approver, input.approved_at,
      input.created_at, input.updated_at,
    );
  },

  /** 更新执行结果 */
  updateStatus(id: string, status: string, executionResult: string | null, errorMessage: string | null, updatedAt: string): void {
    db.prepare(`
      UPDATE config_repair_records SET status = ?, execution_result = ?, error_message = ?, updated_at = ? WHERE id = ?
    `).run(status, executionResult, errorMessage, updatedAt, id);
  },
};