/**
 * vmSnapshotPolicyRepository — vm_snapshot_policies 表数据访问层
 *
 * 覆盖表：vm_snapshot_policies (v050)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface VmSnapshotPolicyRecord {
  id: string;
  name: string;
  platform_id: string;
  vm_id: string;
  cron_expression: string;
  retention: number;
  snapshot_memory: number;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VmSnapshotPolicyCreateInput {
  id: string;
  name: string;
  platform_id: string;
  vm_id: string;
  cron_expression: string;
  retention?: number;
  snapshot_memory?: number;
  enabled?: number;
}

// ── repository 实现 ──

export const vmSnapshotPolicyRepository = {
  listEnabled(): VmSnapshotPolicyRecord[] {
    return db.prepare('SELECT * FROM vm_snapshot_policies WHERE enabled = 1 ORDER BY name').all() as VmSnapshotPolicyRecord[];
  },

  list(): VmSnapshotPolicyRecord[] {
    return db.prepare('SELECT * FROM vm_snapshot_policies ORDER BY name').all() as VmSnapshotPolicyRecord[];
  },

  getById(id: string): VmSnapshotPolicyRecord | undefined {
    return db.prepare('SELECT * FROM vm_snapshot_policies WHERE id = ?').get(id) as VmSnapshotPolicyRecord | undefined;
  },

  create(input: VmSnapshotPolicyCreateInput): void {
    db.prepare(`
      INSERT INTO vm_snapshot_policies (
        id, name, platform_id, vm_id, cron_expression, retention,
        snapshot_memory, enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.platform_id,
      input.vm_id,
      input.cron_expression,
      input.retention ?? 7,
      input.snapshot_memory ?? 0,
      input.enabled ?? 1,
    );
  },

  update(id: string, fields: Record<string, unknown>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && key !== 'id') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE vm_snapshot_policies SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM vm_snapshot_policies WHERE id = ?').run(id);
  },

  updateLastRunAt(id: string): void {
    db.prepare(`UPDATE vm_snapshot_policies SET last_run_at = datetime('now','localtime'), updated_at = datetime('now','localtime') WHERE id = ?`).run(id);
  },
};