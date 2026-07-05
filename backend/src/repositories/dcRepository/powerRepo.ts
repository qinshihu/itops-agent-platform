import db from '../../models/database';
import type { DcPowerPanel, DcPowerFeed } from '../types/dc';

export interface PowerPanelCreateInput {
  id: string;
  room_id: string;
  name: string;
  location_label?: string;
  panel_type?: string;
  voltage?: number;
  amperage?: number;
  phase_count?: number;
  description?: string;
  sort_order?: number;
}

export interface PowerPanelUpdateInput {
  name: string;
  location_label?: string;
  panel_type?: string;
  voltage?: number;
  amperage?: number;
  phase_count?: number;
  description?: string;
  sort_order?: number;
}

export interface PowerFeedCreateInput {
  id: string;
  power_panel_id: string;
  rack_id?: string | null;
  name: string;
  status?: string;
  feed_type?: string;
  supply?: string;
  voltage?: number;
  amperage?: number;
  max_utilization_pct?: number;
  current_load_w?: number;
  description?: string;
}

export interface PowerFeedUpdateInput {
  rack_id?: string | null;
  name: string;
  status?: string;
  feed_type?: string;
  supply?: string;
  voltage?: number;
  amperage?: number;
  max_utilization_pct?: number;
  current_load_w?: number;
  description?: string;
}

export interface FeedListFilters {
  panelId?: string;
}

export const powerRepo = {
  countFeedsByPanel(panelId: string): number {
    return (db.prepare('SELECT COUNT(*) as cnt FROM dc_power_feeds WHERE power_panel_id = ?').get(panelId) as { cnt: number }).cnt;
  },

  deletePanel(id: string): void {
    db.prepare('DELETE FROM dc_power_panels WHERE id = ?').run(id);
  },

  deleteFeed(id: string): void {
    db.prepare('DELETE FROM dc_power_feeds WHERE id = ?').run(id);
  },

  // ── 配电柜（power_panels）──

  /** 配电柜列表 + 机房名 + 馈线数（powerPanels.ts GET /） */
  listPanels(): DcPowerPanel[] {
    return db.prepare(`
      SELECT pp.*, r.name as room_name, r.label as room_label,
        (SELECT COUNT(*) FROM dc_power_feeds WHERE power_panel_id = pp.id) as feed_count
      FROM dc_power_panels pp
      JOIN dc_rooms r ON r.id = pp.room_id
      ORDER BY r.sort_order, pp.sort_order
    `).all() as DcPowerPanel[];
  },

  /** 单个配电柜 + 机房名（powerPanels.ts GET /:id） */
  getPanelById(id: string): DcPowerPanel | undefined {
    return db.prepare(`
      SELECT pp.*, r.name as room_name FROM dc_power_panels pp
      JOIN dc_rooms r ON r.id = pp.room_id WHERE pp.id = ?
    `).get(id) as DcPowerPanel | undefined;
  },

  /** 配电柜下的馈线 + 机柜名（powerPanels.ts GET /:id 子查询） */
  listFeedsByPanel(panelId: string): DcPowerFeed[] {
    return db.prepare(`
      SELECT pf.*, r.name as rack_name
      FROM dc_power_feeds pf
      LEFT JOIN dc_racks r ON r.id = pf.rack_id
      WHERE pf.power_panel_id = ? ORDER BY pf.name
    `).all(panelId) as DcPowerFeed[];
  },

  createPanel(input: PowerPanelCreateInput): void {
    db.prepare(`
      INSERT INTO dc_power_panels (id, room_id, name, location_label, panel_type, voltage, amperage, phase_count, description, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.room_id, input.name, input.location_label ?? '',
      input.panel_type ?? 'rpp', input.voltage ?? 220, input.amperage ?? 63,
      input.phase_count ?? 3, input.description ?? '', input.sort_order ?? 0
    );
  },

  updatePanel(id: string, input: PowerPanelUpdateInput): void {
    db.prepare(`
      UPDATE dc_power_panels SET name=?, location_label=?, panel_type=?, voltage=?, amperage=?,
        phase_count=?, description=?, sort_order=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.name, input.location_label ?? '', input.panel_type ?? 'rpp',
      input.voltage ?? 220, input.amperage ?? 63, input.phase_count ?? 3,
      input.description ?? '', input.sort_order ?? 0, id
    );
  },

  // ── 馈线（power_feeds）──

  /** 馈线列表 + 配电柜名 + 机柜名（powerFeeds.ts GET /） */
  listFeeds(filters: FeedListFilters = {}): DcPowerFeed[] {
    let query = `
      SELECT pf.*, pp.name as panel_name, r.name as rack_name, r.label as rack_label
      FROM dc_power_feeds pf
      JOIN dc_power_panels pp ON pp.id = pf.power_panel_id
      LEFT JOIN dc_racks r ON r.id = pf.rack_id
    `;
    const params: unknown[] = [];
    if (filters.panelId) {
      query += ' WHERE pf.power_panel_id = ?';
      params.push(filters.panelId);
      query += ' ORDER BY pf.name';
    } else {
      query += ' ORDER BY pp.name, pf.name';
    }
    return db.prepare(query).all(...params) as DcPowerFeed[];
  },

  /** 按机柜列出馈线（powerFeeds.ts GET /rack/:rackId） */
  listFeedsByRack(rackId: string): DcPowerFeed[] {
    return db.prepare(`
      SELECT pf.*, pp.name as panel_name
      FROM dc_power_feeds pf
      JOIN dc_power_panels pp ON pp.id = pf.power_panel_id
      WHERE pf.rack_id = ? ORDER BY pf.feed_type, pf.name
    `).all(rackId) as DcPowerFeed[];
  },

  /** 单条馈线 + 配电柜名 + 机柜名（powerFeeds.ts GET /:id） */
  getFeedById(id: string): DcPowerFeed | undefined {
    return db.prepare(`
      SELECT pf.*, pp.name as panel_name, pp.room_id,
        r.name as rack_name, r.label as rack_label
      FROM dc_power_feeds pf
      JOIN dc_power_panels pp ON pp.id = pf.power_panel_id
      LEFT JOIN dc_racks r ON r.id = pf.rack_id
      WHERE pf.id = ?
    `).get(id) as DcPowerFeed | undefined;
  },

  createFeed(input: PowerFeedCreateInput): void {
    db.prepare(`
      INSERT INTO dc_power_feeds (id, power_panel_id, rack_id, name, status, feed_type, supply, voltage, amperage, max_utilization_pct, current_load_w, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.power_panel_id, input.rack_id ?? null, input.name,
      input.status ?? 'active', input.feed_type ?? 'primary', input.supply ?? 'ac',
      input.voltage ?? 220, input.amperage ?? 16, input.max_utilization_pct ?? 80,
      input.current_load_w ?? 0, input.description ?? ''
    );
  },

  updateFeed(id: string, input: PowerFeedUpdateInput): void {
    db.prepare(`
      UPDATE dc_power_feeds SET rack_id=?, name=?, status=?, feed_type=?, supply=?,
        voltage=?, amperage=?, max_utilization_pct=?, current_load_w=?, description=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.rack_id ?? null, input.name, input.status ?? 'active', input.feed_type ?? 'primary',
      input.supply ?? 'ac', input.voltage ?? 220, input.amperage ?? 16,
      input.max_utilization_pct ?? 80, input.current_load_w ?? 0,
      input.description ?? '', id
    );
  },
};
