import db from '../../models/database';
import type { ServerRecord } from './types';
import type { ServerGroupRecord, ServerGroupCreateInput } from './types';

// ── groups 子 repository ──

export const groupsRepo = {
  /**
   * 列出全部分组（含 server_count / children_count 聚合）
   */
  list(): Array<ServerGroupRecord & { server_count: number; children_count: number }> {
    return db.prepare(`
      SELECT sg.*,
        (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count,
        (SELECT COUNT(*) FROM server_groups WHERE parent_id = sg.id) as children_count
      FROM server_groups sg
      ORDER BY sg.sort_order ASC, sg.created_at ASC
    `).all() as Array<ServerGroupRecord & { server_count: number; children_count: number }>;
  },

  /**
   * 列出分组（含 server_count，不含 children_count，用于树构建）
   */
  listForTree(): Array<ServerGroupRecord & { server_count: number }> {
    return db.prepare(`
      SELECT sg.*,
        (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count
      FROM server_groups sg
      ORDER BY sg.sort_order ASC, sg.created_at ASC
    `).all() as Array<ServerGroupRecord & { server_count: number }>;
  },

  /** 按 ID 查询分组 */
  getById(id: string): ServerGroupRecord | undefined {
    return db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as ServerGroupRecord | undefined;
  },

  /** 按 ID 检查存在性 */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT id FROM server_groups WHERE id = ?').get(id);
    return !!row;
  },

  /** 统计子分组数 */
  countChildren(id: string): number {
    return (db.prepare('SELECT COUNT(*) as c FROM server_groups WHERE parent_id = ?').get(id) as { c: number }).c;
  },

  /** 创建分组 */
  create(input: ServerGroupCreateInput): void {
    db.prepare(`
      INSERT INTO server_groups (id, name, description, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.id, input.name, input.description ?? null, input.parent_id ?? null, input.sort_order || 0);
  },

  /** 更新分组（COALESCE 部分更新） */
  update(id: string, input: {
    name?: string;
    description?: string | null;
    parent_id?: string | null;
    sort_order?: number;
  }): void {
    db.prepare(`
      UPDATE server_groups
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          parent_id = COALESCE(?, parent_id),
          sort_order = COALESCE(?, sort_order),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.name ?? null,
      input.description !== undefined ? input.description : null,
      input.parent_id !== undefined ? input.parent_id : null,
      input.sort_order !== undefined ? input.sort_order : null,
      id
    );
  },

  /** 移动分组（修改 parent_id 和 sort_order） */
  move(id: string, newParentId: string | null, sortOrder?: number): void {
    db.prepare(`
      UPDATE server_groups
      SET parent_id = ?, sort_order = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newParentId, sortOrder ?? 0, id);
  },

  /** 删除分组（先删映射再删分组） */
  delete(id: string): void {
    db.prepare('DELETE FROM server_group_mapping WHERE group_id = ?').run(id);
    db.prepare('DELETE FROM server_groups WHERE id = ?').run(id);
  },

  // ── server_group_mapping ──

  /** 添加映射（幂等） */
  addMapping(serverId: string, groupId: string): void {
    db.prepare('INSERT OR IGNORE INTO server_group_mapping (server_id, group_id) VALUES (?, ?)').run(serverId, groupId);
  },

  /** 删除映射 */
  removeMapping(serverId: string, groupId: string): void {
    db.prepare('DELETE FROM server_group_mapping WHERE server_id = ? AND group_id = ?').run(serverId, groupId);
  },

  /** 列出服务器所属的分组 */
  listByServer(serverId: string): ServerGroupRecord[] {
    return db.prepare(`
      SELECT sg.* FROM server_groups sg
      JOIN server_group_mapping sgm ON sg.id = sgm.group_id
      WHERE sgm.server_id = ?
      ORDER BY sg.sort_order ASC
    `).all(serverId) as ServerGroupRecord[];
  },

  /** 列出分组下的服务器 */
  listServersByGroup(groupId: string): ServerRecord[] {
    return db.prepare(`
      SELECT s.* FROM servers s
      JOIN server_group_mapping sgm ON s.id = sgm.server_id
      WHERE sgm.group_id = ?
      ORDER BY s.name ASC
    `).all(groupId) as ServerRecord[];
  },
};