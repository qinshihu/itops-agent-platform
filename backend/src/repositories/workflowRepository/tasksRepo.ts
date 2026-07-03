import db from '../../models/database';
import type { TaskRecord, TaskCreateInput, TaskCreateWithStatusInput, TaskListFilters, TaskLogEntry } from './types';

// ── tasks 子 repository ──

export const tasksRepo = {
  /**
   * 动态查询任务列表（可选 status 过滤 + 可选 LIMIT）
   * 对应 taskRoutes.ts T-SELECT-1
   */
  list(filters?: TaskListFilters): TaskRecord[] {
    let sql = 'SELECT * FROM tasks';
    const params: unknown[] = [];
    if (filters?.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY created_at DESC';
    if (filters?.limit && filters.limit > 0) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    return db.prepare(sql).all(...params) as TaskRecord[];
  },

  /**
   * 按 id 获取完整任务
   * 对应 taskRoutes.ts T-SELECT-2 / workflowExecutor.ts
   */
  getById(id: string): TaskRecord | undefined {
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRecord | undefined;
  },

  /**
   * 按 id 获取 status（取消检查用）
   * 对应 workflowExecutor.ts T-SELECT-3
   */
  getStatus(id: string): string | undefined {
    const row = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
    return row?.status;
  },

  /**
   * 按 id 获取 context（回滚 remediation_id 查询用）
   * 对应 workflowExecutor.ts T-SELECT-4
   */
  getContext(id: string): string | null | undefined {
    const row = db.prepare('SELECT context FROM tasks WHERE id = ?').get(id) as { context: string | null } | undefined;
    return row?.context;
  },

  /**
   * 按 id 获取 start_time/end_time（报表生成用）
   * 对应 workflowExecutor.ts T-SELECT-5
   */
  getStartEndTime(id: string): { start_time: string | null; end_time: string | null } | undefined {
    return db.prepare('SELECT start_time, end_time FROM tasks WHERE id = ?')
      .get(id) as { start_time: string | null; end_time: string | null } | undefined;
  },

  /**
   * 获取最近 N 条任务（copilot 用）
   * 对应 copilotService.ts T-SELECT-7
   */
  listRecent(limit: number): TaskRecord[] {
    return db.prepare('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?').all(limit) as TaskRecord[];
  },

  /**
   * 获取最近 10 条任务（仪表盘精简字段）
   * 对应 dashboardRoutes.ts T-SELECT-8
   */
  listRecentForDashboard(): Array<{
    id: string; name: string; status: string; created_at: string;
    workflow_id: string; execution_order: number | null; node_results: string | null; current_node_id: string | null;
  }> {
    return db.prepare(`
      SELECT id, name, status, created_at, workflow_id, execution_order, node_results, current_node_id
      FROM tasks ORDER BY created_at DESC LIMIT 10
    `).all() as Array<{
      id: string; name: string; status: string; created_at: string;
      workflow_id: string; execution_order: number | null; node_results: string | null; current_node_id: string | null;
    }>;
  },

  /**
   * 统计 pending 任务数
   * 对应 selfMonitorService.ts T-SELECT-14
   */
  countPending(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'")
      .get() as { count: number };
    return row.count;
  },

  /**
   * 创建任务（5 字段，status 硬编码 'pending'，含 context）
   * 对应 taskRoutes.ts T-INSERT-1
   */
  create(input: TaskCreateInput): void {
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(input.id, input.workflow_id, input.name, input.context ?? null);
  },

  /**
   * 创建任务（5 字段，status 硬编码 'pending'，含 created_at，无 context）
   * 对应 schedulerService.ts T-INSERT-2
   */
  createWithTimestamp(input: { id: string; workflow_id: string; name: string }): void {
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, created_at)
      VALUES (?, ?, ?, 'pending', datetime('now','localtime'))
    `).run(input.id, input.workflow_id, input.name);
  },

  /**
   * 创建任务（6 字段，status 硬编码 'pending'，含 context + created_at）
   * 对应 aiRemediationService.ts / remediationService.ts T-INSERT-3
   */
  createPendingWithContext(input: TaskCreateInput): void {
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now','localtime'))
    `).run(input.id, input.workflow_id, input.name, input.context ?? null);
  },

  /**
   * 创建任务（6 字段，status 作为参数，含 context + created_at）
   * 对应 alertWorkflowMappingService.ts T-INSERT-4
   */
  createWithStatus(input: TaskCreateWithStatusInput): void {
    db.prepare(`
      INSERT INTO tasks (id, workflow_id, name, status, context, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.id, input.workflow_id, input.name, input.status, input.context ?? null);
  },

  // ── UPDATE：状态变更 ──

  /**
   * 仅更新 status（暂停/恢复用）
   * 对应 taskRoutes.ts T-UPDATE-1
   */
  updateStatus(id: string, status: string): number {
    const result = db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + end_time（取消/失败用）
   * 对应 taskRoutes.ts T-UPDATE-2 / workflowExecutor.ts
   */
  updateStatusWithEndTime(id: string, status: string): number {
    const result = db.prepare(`
      UPDATE tasks SET status = ?, end_time = datetime('now','localtime') WHERE id = ?
    `).run(status, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + start_time + execution_order（开始运行用，execution_order 可为 JSON 字符串）
   * 对应 workflowExecutor.ts T-UPDATE-3
   */
  updateStatusWithStart(id: string, status: string, executionOrder: number | string): number {
    const result = db.prepare(`
      UPDATE tasks
      SET status = ?, start_time = datetime('now','localtime'), execution_order = ?
      WHERE id = ?
    `).run(status, executionOrder, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + end_time + current_node_id=NULL（失败终态）
   * 对应 workflowExecutor.ts T-UPDATE-4
   */
  updateStatusFailureFinalize(id: string, status: string): number {
    const result = db.prepare(`
      UPDATE tasks
      SET status = ?, end_time = datetime('now','localtime'), current_node_id = NULL
      WHERE id = ?
    `).run(status, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + current_node_id + context（等待审批用）
   * 对应 workflowExecutor.ts T-UPDATE-5
   */
  updateStatusWithNodeContext(id: string, status: string, currentNodeId: string, context: string): number {
    const result = db.prepare(`
      UPDATE tasks SET status = ?, current_node_id = ?, context = ? WHERE id = ?
    `).run(status, currentNodeId, context, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + current_node_id=NULL（审批恢复用）
   * 对应 workflowExecutor.ts T-UPDATE-6
   */
  updateStatusClearNode(id: string, status: string): number {
    const result = db.prepare(`
      UPDATE tasks SET status = ?, current_node_id = NULL WHERE id = ?
    `).run(status, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新 status + end_time + node_results + current_node_id=NULL（完成终态）
   * 对应 workflowExecutor.ts T-UPDATE-7
   */
  finalizeTask(id: string, status: string, nodeResults: string): number {
    const result = db.prepare(`
      UPDATE tasks
      SET status = ?, end_time = datetime('now','localtime'), node_results = ?, current_node_id = NULL
      WHERE id = ?
    `).run(status, nodeResults, id);
    return (result as { changes: number }).changes;
  },

  // ── UPDATE：字段更新 ──

  /**
   * 仅更新 node_results（回滚更新用）
   * 对应 workflowExecutor.ts T-UPDATE-8
   */
  updateNodeResults(id: string, nodeResults: string): number {
    const result = db.prepare('UPDATE tasks SET node_results = ? WHERE id = ?').run(nodeResults, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 仅更新 report_id
   * 对应 workflowExecutor.ts T-UPDATE-9
   */
  updateReportId(id: string, reportId: string): number {
    const result = db.prepare('UPDATE tasks SET report_id = ? WHERE id = ?').run(reportId, id);
    return (result as { changes: number }).changes;
  },

  /**
   * 追加任务日志（json_insert）
   * 对应 workflowExecutor.ts T-UPDATE-10
   */
  appendTaskLog(id: string, log: TaskLogEntry): void {
    db.prepare(`
      UPDATE tasks
      SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
        'timestamp', datetime('now'),
        'type', ?,
        'content', ?,
        'nodeId', ?
      ))
      WHERE id = ?
    `).run(log.type, log.content, log.nodeId ?? null, id);
  },

  /**
   * 追加干预跳过日志
   * 对应 taskRoutes.ts T-UPDATE-11
   */
  appendInterventionSkipLog(id: string, nodeId: string): void {
    db.prepare(`
      UPDATE tasks
      SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
        'timestamp', datetime('now'),
        'type', 'intervention',
        'content', 'Node ' || ? || ' skipped by user'
      ))
      WHERE id = ?
    `).run(nodeId, id);
  },

  /**
   * 追加干预修改日志（含 data）
   * 对应 taskRoutes.ts T-UPDATE-12
   */
  appendInterventionModifyLog(id: string, nodeId: string, data: string): void {
    db.prepare(`
      UPDATE tasks
      SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
        'timestamp', datetime('now'),
        'type', 'intervention',
        'content', 'Node ' || ? || ' modified by user',
        'data', ?
      ))
      WHERE id = ?
    `).run(nodeId, data, id);
  },
};
