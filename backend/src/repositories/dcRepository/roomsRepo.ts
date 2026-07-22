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

  /**
   * 获取机房 3D 场景的布局配置
   * 返回 { id, name, layout_config: object }[]，layout_config 已 JSON.parse
   */
  listLayouts(): Array<{ id: string; name: string; layout_config: Record<string, unknown> }> {
    const rows = db.prepare(`
      SELECT id, name, layout_config
      FROM dc_rooms
      WHERE layout_config IS NOT NULL AND layout_config != '' AND layout_config != '{}'
    `).all() as Array<{ id: string; name: string; layout_config: string }>;
    return rows.map(r => {
      try {
        return { id: r.id, name: r.name, layout_config: JSON.parse(r.layout_config) as Record<string, unknown> };
      } catch {
        return { id: r.id, name: r.name, layout_config: {} };
      }
    });
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
    // v058 migration 已为 dc_racks.room_id 加 FK ON DELETE CASCADE，
    // 即可级联 dc_rack_slots、dc_pdus.rack_id (SET NULL)
    // 但 PDU 不在 v058 的 SET NULL 链路里（PDU 仅当 rack 删除时 SET NULL），
    // 所以手写事务以确保：
    //   1) 先清理该机房下所有 PDU 的关联（保留 PDU 记录，仅置 null）
    //   2) 删 dc_rack_slots（FK 自动级联）
    //   3) 删 dc_racks（FK 自动级联到 slot）
    //   4) 删 dc_rooms
    const tx = db.transaction((roomId: string) => {
      // PDU.rack_id → null（如果机柜没了，PDU 不必删除）
      db.prepare(`
        UPDATE dc_pdus SET rack_id = NULL
        WHERE rack_id IN (SELECT id FROM dc_racks WHERE room_id = ?)
      `).run(roomId);

      // 删除该机房下所有机柜 → FK CASCADE 自动清理 slot
      db.prepare('DELETE FROM dc_racks WHERE room_id = ?').run(roomId);

      // 删除机房本身
      db.prepare('DELETE FROM dc_rooms WHERE id = ?').run(roomId);
    });
    tx(id);
  },

  deleteAll(): void {
    db.prepare('DELETE FROM dc_device_lifecycle').run();
    db.prepare('DELETE FROM dc_rack_slots').run();
    db.prepare('DELETE FROM dc_pdus').run();
    db.prepare('DELETE FROM dc_racks').run();
    db.prepare('DELETE FROM dc_rooms').run();
  },
};
