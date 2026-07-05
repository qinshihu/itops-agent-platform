import db from '../../models/database';
import type { DcRoom } from '../types/dc';

export interface DcRoomCreateInput {
  id: string;
  name: string;
  label?: string;
  description?: string;
  width_m?: number;
  depth_m?: number;
  layout_config?: string;
  sort_order?: number;
}

export interface DcRoomUpdateInput {
  name: string;
  label?: string;
  description?: string;
  width_m?: number;
  depth_m?: number;
  layout_config?: string;
  sort_order?: number;
}

export const roomsRepo = {
  list(): DcRoom[] {
    return db.prepare('SELECT * FROM dc_rooms ORDER BY sort_order').all() as DcRoom[];
  },

  /** 导出用：不排序，保留原始顺序 */
  listAll(): DcRoom[] {
    return db.prepare('SELECT * FROM dc_rooms').all() as DcRoom[];
  },

  create(input: DcRoomCreateInput): void {
    db.prepare(`
      INSERT INTO dc_rooms (id, name, label, description, width_m, depth_m, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.label ?? '', input.description ?? '',
      input.width_m ?? 20, input.depth_m ?? 15, input.sort_order ?? 0
    );
  },

  /** 导入用：含 layout_config 字段 */
  createForImport(input: DcRoomCreateInput & { layout_config?: string }): void {
    db.prepare(`
      INSERT INTO dc_rooms (id, name, label, description, width_m, depth_m, layout_config, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      input.id, input.name, input.label ?? '', input.description ?? '',
      input.width_m ?? 20, input.depth_m ?? 15, input.layout_config ?? '{}', input.sort_order ?? 0
    );
  },

  update(id: string, input: DcRoomUpdateInput): void {
    db.prepare(`
      UPDATE dc_rooms
      SET name=?, label=?, description=?, width_m=?, depth_m=?,
          layout_config=?, sort_order=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.name, input.label ?? '', input.description ?? '',
      input.width_m ?? 20, input.depth_m ?? 15,
      input.layout_config ?? '{}', input.sort_order ?? 0, id
    );
  },

  delete(id: string): void {
    // 级联删除：先删 rack + slot，再删 room
    db.prepare('DELETE FROM dc_rack_slots WHERE rack_id IN (SELECT id FROM dc_racks WHERE room_id = ?)').run(id);
    db.prepare('DELETE FROM dc_racks WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM dc_rooms WHERE id = ?').run(id);
  },

  deleteAll(): void {
    db.prepare('DELETE FROM dc_device_lifecycle').run();
    db.prepare('DELETE FROM dc_rack_slots').run();
    db.prepare('DELETE FROM dc_pdus').run();
    db.prepare('DELETE FROM dc_racks').run();
    db.prepare('DELETE FROM dc_rooms').run();
  },
};
