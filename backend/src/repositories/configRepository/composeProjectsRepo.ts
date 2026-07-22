/**
 * composeProjectsRepo — compose_projects 表的数据访问层
 *
 * 覆盖 composeService.ts 中直接 db.prepare 调用，包括：
 *   - listAll / getById / create / update / delete
 *   - setStatus / updateStatus
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface ComposeProjectRecord {
  id: string;
  name: string;
  description: string | null;
  compose_content: string;
  status: string;
  service_count: number;
  running_count: number;
  working_dir: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface ComposeProjectCreateInput {
  id: string;
  name: string;
  description: string;
  compose_content: string;
  working_dir: string;
  tags: string;
}

export interface ComposeProjectUpdateInput {
  name: string | null;
  description: string | null;
  compose_content: string | null;
  tags: string | null;
  updated_at: string;
}

// ── repository 实现 ──

export const composeProjectsRepo = {
  /** 列出所有项目 */
  listAll(): ComposeProjectRecord[] {
    return db.prepare('SELECT * FROM compose_projects ORDER BY updated_at DESC').all() as ComposeProjectRecord[];
  },

  /** 按 ID 查询 */
  getById(id: string): ComposeProjectRecord | undefined {
    return db.prepare('SELECT * FROM compose_projects WHERE id = ?').get(id) as ComposeProjectRecord | undefined;
  },

  /** 创建项目 */
  create(input: ComposeProjectCreateInput): void {
    db.prepare(`
      INSERT INTO compose_projects (id, name, description, compose_content, working_dir, tags)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.name, input.description, input.compose_content, input.working_dir, input.tags);
  },

  /** 更新项目信息 */
  updateNamesAndContent(id: string, input: ComposeProjectUpdateInput): void {
    db.prepare(`
      UPDATE compose_projects SET name=?, description=?, compose_content=?, tags=?, updated_at=? WHERE id=?
    `).run(input.name, input.description, input.compose_content, input.tags, input.updated_at, id);
  },

  /** 删除项目 */
  delete(id: string): boolean {
    return db.prepare('DELETE FROM compose_projects WHERE id = ?').run(id).changes > 0;
  },

  /** 设置部署中状态 */
  setDeploying(id: string): void {
    db.prepare("UPDATE compose_projects SET status='deploying', updated_at=datetime('now','localtime') WHERE id=?").run(id);
  },

  /** 设置错误状态 */
  setError(id: string): void {
    db.prepare("UPDATE compose_projects SET status='error', updated_at=datetime('now','localtime') WHERE id=?").run(id);
  },

  /** 设置停止状态 */
  setStopped(id: string): void {
    db.prepare("UPDATE compose_projects SET status='stopped', running_count=0, updated_at=datetime('now','localtime') WHERE id=?").run(id);
  },

  /** 更新运行状态 */
  updateStatus(id: string, status: string, serviceCount: number, runningCount: number): void {
    db.prepare("UPDATE compose_projects SET status=?, service_count=?, running_count=?, updated_at=datetime('now','localtime') WHERE id=?")
      .run(status, serviceCount, runningCount, id);
  },
};