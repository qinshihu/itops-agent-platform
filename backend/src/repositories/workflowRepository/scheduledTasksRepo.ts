import db from '../../models/database';
import type { ScheduledTaskRecord, ScheduledTaskWithWorkflow, ScheduledTaskCreateInput, ScheduledTaskUpdateInput } from './types';

// ── scheduled_tasks 子 repository ──

export const scheduledTasksRepo = {
  /**
   * 列出全部定时任务（含 workflow_name 和兼容别名）
   * 对应 scheduledTaskRoutes.ts ST-SELECT-1
   */
  list(): ScheduledTaskWithWorkflow[] {
    return db.prepare(`
      SELECT st.id, st.name, st.description, st.workflow_id,
             st.schedule, st.schedule as cron_expression,
             st.enabled, st.last_run, st.last_run as last_run_at,
             st.next_run, st.next_run as next_run_at,
             st.last_status, st.context, st.created_at, st.updated_at,
             w.name as workflow_name
      FROM scheduled_tasks st
      LEFT JOIN workflows w ON st.workflow_id = w.id
      ORDER BY st.created_at DESC
    `).all() as ScheduledTaskWithWorkflow[];
  },

  /**
   * 按 id 获取定时任务（含 workflow_name 和兼容别名）
   * 对应 scheduledTaskRoutes.ts ST-SELECT-2
   */
  getByIdWithWorkflow(id: string): ScheduledTaskWithWorkflow | undefined {
    return db.prepare(`
      SELECT st.id, st.name, st.description, st.workflow_id,
             st.schedule, st.schedule as cron_expression,
             st.enabled, st.last_run, st.last_run as last_run_at,
             st.next_run, st.next_run as next_run_at,
             st.last_status, st.context, st.created_at, st.updated_at,
             w.name as workflow_name
      FROM scheduled_tasks st
      LEFT JOIN workflows w ON st.workflow_id = w.id
      WHERE st.id = ?
    `).get(id) as ScheduledTaskWithWorkflow | undefined;
  },

  /**
   * 按 id 获取完整记录（无联表）
   * 对应 scheduledTaskRoutes.ts ST-SELECT-3
   */
  getById(id: string): ScheduledTaskRecord | undefined {
    return db.prepare('SELECT * FROM scheduled_tasks WHERE id = ?').get(id) as ScheduledTaskRecord | undefined;
  },

  /**
   * 按 id 获取手动运行所需字段
   * 对应 scheduledTaskRoutes.ts ST-SELECT-4
   */
  getByIdForManualRun(id: string): {
    id: string; name: string; workflow_id: string; schedule: string; enabled: number;
  } | undefined {
    return db.prepare('SELECT id, name, workflow_id, schedule, enabled FROM scheduled_tasks WHERE id = ?')
      .get(id) as { id: string; name: string; workflow_id: string; schedule: string; enabled: number } | undefined;
  },

  /**
   * 列出启用的定时任务（调度器初始化用）
   * 对应 schedulerService.ts ST-SELECT-5
   */
  listEnabled(): ScheduledTaskRecord[] {
    return db.prepare('SELECT * FROM scheduled_tasks WHERE enabled = 1').all() as ScheduledTaskRecord[];
  },

  /**
   * 统计总数（预设初始化检查用）
   * 对应 models/database.ts ST-SELECT-6
   */
  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM scheduled_tasks').get() as { count: number };
    return row.count;
  },

  /**
   * 创建定时任务（8 字段）
   * 对应 scheduledTaskRoutes.ts ST-INSERT-1
   */
  create(input: ScheduledTaskCreateInput): void {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO scheduled_tasks (id, name, description, workflow_id, schedule, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.description ?? null,
      input.workflow_id ?? null,
      input.schedule,
      input.enabled,
      now,
      now
    );
  },

  /**
   * 创建预设定时任务（6 字段，不同列顺序）
   * 对应 presets/initScheduledTasks.ts ST-INSERT-2
   */
  createPreset(input: {
    id: string; name: string; description?: string | null; schedule: string; enabled: number; workflow_id: string;
  }): void {
    db.prepare(`
      INSERT INTO scheduled_tasks (id, name, description, schedule, enabled, workflow_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.description ?? null,
      input.schedule,
      input.enabled,
      input.workflow_id
    );
  },

  /**
   * 动态更新定时任务（构建 SET 子句）
   * 对应 scheduledTaskRoutes.ts ST-UPDATE-1
   */
  update(id: string, fields: ScheduledTaskUpdateInput): number {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { setClauses.push('name = ?'); values.push(fields.name); }
    if (fields.description !== undefined) { setClauses.push('description = ?'); values.push(fields.description); }
    if (fields.workflow_id !== undefined) { setClauses.push('workflow_id = ?'); values.push(fields.workflow_id); }
    if (fields.schedule !== undefined) { setClauses.push('schedule = ?'); values.push(fields.schedule); }
    if (fields.enabled !== undefined) { setClauses.push('enabled = ?'); values.push(fields.enabled); }

    if (setClauses.length === 0) return 0;

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const result = db.prepare(`UPDATE scheduled_tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return (result as { changes: number }).changes;
  },

  /**
   * 切换启用状态
   * 对应 scheduledTaskRoutes.ts ST-UPDATE-2
   */
  setEnabled(id: string, enabled: number): number {
    const result = db.prepare('UPDATE scheduled_tasks SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled, new Date().toISOString(), id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 last_run + last_status（执行完成后）
   * 对应 schedulerService.ts ST-UPDATE-3
   */
  updateLastRun(id: string, status: string): void {
    db.prepare(`
      UPDATE scheduled_tasks
      SET last_run = datetime('now','localtime'), last_status = ?
      WHERE id = ?
    `).run(status, id);
  },

  /**
   * 更新 next_run
   * 对应 schedulerService.ts ST-UPDATE-4
   */
  updateNextRun(id: string, nextRun: string): void {
    db.prepare('UPDATE scheduled_tasks SET next_run = ? WHERE id = ?').run(nextRun, id);
  },

  /**
   * 按 id 删除定时任务
   * 注意：调用方需先调用 schedulerService.deleteTask() 取消内存中的 job
   * 对应 scheduledTaskRoutes.ts ST-DELETE-1
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },
};
