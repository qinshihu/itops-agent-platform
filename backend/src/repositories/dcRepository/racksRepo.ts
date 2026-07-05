import db from '../../models/database';
import type { DcRack } from '../types/dc';
import type { DcRackRecord, DcRackCreateInput } from './types';

export interface RackListFilters {
  roomId?: string;
  status?: string;
  search?: string;
}

export const racksRepo = {
  /**
   * 机柜列表（带 room_name / device_count / used_u 聚合）
   */
  list(filters: RackListFilters = {}): DcRack[] {
    let query = `
      SELECT r.*, rm.name as room_name, rm.label as room_label,
        (SELECT COUNT(*) FROM dc_rack_slots WHERE rack_id = r.id) as device_count,
        (SELECT IFNULL(SUM(used_u), 0) FROM (
          SELECT (end_u - start_u + 1) as used_u FROM dc_rack_slots WHERE rack_id = r.id
        )) as used_u
      FROM dc_racks r
      LEFT JOIN dc_rooms rm ON r.room_id = rm.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.roomId) { query += ' AND r.room_id = ?'; params.push(filters.roomId); }
    if (filters.status) { query += ' AND r.status = ?'; params.push(filters.status); }
    if (filters.search) { query += ' AND r.name LIKE ?'; params.push(`%${filters.search}%`); }
    query += ' ORDER BY r.sort_order ASC, r.name ASC';
    return db.prepare(query).all(...params) as DcRack[];
  },

  getById(id: string): DcRackRecord | undefined {
    return db.prepare('SELECT * FROM dc_racks WHERE id = ?').get(id) as DcRackRecord | undefined;
  },

  create(input: DcRackCreateInput): void {
    db.prepare(`
      INSERT INTO dc_racks (id, name, room_id, row_number, total_u, sort_order, position_x, position_z)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.room_id,
      input.row_number || 0, input.total_u || 42,
      input.sort_order || 0, input.position_x || 0, input.position_z || 0
    );
  },

  /** 导入用：含 status 字段 */
  createForImport(input: DcRackCreateInput & { status?: string }): void {
    db.prepare(`
      INSERT INTO dc_racks (id, name, room_id, row_number, total_u, status, sort_order, position_x, position_z, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      input.id, input.name, input.room_id,
      input.row_number || 0, input.total_u || 42, input.status || 'normal',
      input.sort_order || 0, input.position_x || 0, input.position_z || 0
    );
  },

  update(id: string, input: {
    name?: string; room_id?: string; row_number?: number; total_u?: number;
    status?: string; sort_order?: number; position_x?: number; position_z?: number;
  }): void {
    db.prepare(`
      UPDATE dc_racks SET name=?, room_id=?, row_number=?, total_u=?, status=?,
        sort_order=?, position_x=?, position_z=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.name, input.room_id, input.row_number || 0, input.total_u || 42,
      input.status || 'normal', input.sort_order || 0, input.position_x || 0, input.position_z || 0,
      id
    );
  },

  /** 删除机柜（级联删除其下所有 slot） */
  delete(id: string): void {
    db.prepare('DELETE FROM dc_rack_slots WHERE rack_id = ?').run(id);
    db.prepare('DELETE FROM dc_racks WHERE id = ?').run(id);
  },

  count(): number {
    return (db.prepare('SELECT COUNT(*) as c FROM dc_racks').get() as { c: number }).c;
  },

  listAll(): DcRackRecord[] {
    return db.prepare('SELECT * FROM dc_racks').all() as DcRackRecord[];
  },

  /** 拓扑可视化用：仅返回 id/name/坐标/U 数 */
  listForTopology(): Array<{ id: string; name: string; position_x: number; position_z: number; total_u: number }> {
    return db.prepare('SELECT id, name, position_x, position_z, total_u FROM dc_racks').all() as Array<{
      id: string; name: string; position_x: number; position_z: number; total_u: number;
    }>;
  },

  /**
   * 总览用：机柜 JOIN 机房，聚合 device_count / used_u / 温湿度
   * 按 room.sort_order, rack.sort_order 排序
   */
  listForOverview(): DcRack[] {
    return db.prepare(`
      SELECT r.*, rm.name as room_name, rm.label as room_label,
        (SELECT COUNT(*) FROM dc_rack_slots WHERE rack_id = r.id) as device_count,
        (SELECT COALESCE(SUM(end_u - start_u + 1), 0) FROM dc_rack_slots WHERE rack_id = r.id) as used_u,
        rm.current_temperature, rm.current_humidity
      FROM dc_racks r
      JOIN dc_rooms rm ON r.room_id = rm.id
      ORDER BY rm.sort_order, r.sort_order
    `).all() as DcRack[];
  },

  /**
   * DC 状态推送用：机柜利用率（仅统计已分配设备的 slot），按名称排序
   */
  listWithOccupiedUtil(): DcRack[] {
    return db.prepare(`
      SELECT r.id, r.name,
        (SELECT COALESCE(SUM(end_u - start_u + 1), 0) FROM dc_rack_slots WHERE rack_id = r.id) as used_u,
        r.total_u,
        (SELECT COUNT(*) FROM dc_rack_slots WHERE rack_id = r.id AND device_id IS NOT NULL) as device_count
      FROM dc_racks r
      ORDER BY r.name
    `).all() as DcRack[];
  },
};
