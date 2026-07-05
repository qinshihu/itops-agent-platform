import db from '../../models/database';
import type { DcPdu } from '../types/dc';

export interface PduCreateInput {
  id: string;
  name: string;
  type?: string;
  status?: string;
  rack_id?: string | null;
  power_capacity_w?: number;
  current_load_w?: number;
  input_voltage?: number;
  output_sockets?: number;
  model?: string;
  ip_address?: string;
  snmp_community?: string;
  notes?: string;
}

export type PduUpdateInput = PduCreateInput;

export interface PduImportInput {
  id: string;
  name: string;
  type?: string;
  status?: string;
  rack_id?: string | null;
  power_capacity_w?: number;
  current_load_w?: number;
  input_voltage?: number;
  output_sockets?: number;
  model?: string;
  ip_address?: string;
  snmp_community?: string;
  notes?: string;
}

export const pdusRepo = {
  list(): DcPdu[] {
    return db.prepare('SELECT * FROM dc_pdus').all() as DcPdu[];
  },

  /** PDU 列表 + 机柜名（pdus.ts GET /） */
  listWithRack(): DcPdu[] {
    return db.prepare(`
      SELECT p.*, r.name as rack_name
      FROM dc_pdus p
      LEFT JOIN dc_racks r ON p.rack_id = r.id
      ORDER BY p.name
    `).all() as DcPdu[];
  },

  create(input: PduCreateInput): void {
    db.prepare(`
      INSERT INTO dc_pdus (id, name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.type ?? 'pdu', input.status ?? 'active', input.rack_id ?? null,
      input.power_capacity_w ?? 0, input.current_load_w ?? 0, input.input_voltage ?? 220,
      input.output_sockets ?? 0, input.model ?? '', input.ip_address ?? '',
      input.snmp_community ?? '', input.notes ?? ''
    );
  },

  /** 导入用：与 create 等价（保留独立方法以便未来扩展） */
  createForImport(input: PduImportInput): void {
    db.prepare(`
      INSERT INTO dc_pdus (id, name, type, status, rack_id, power_capacity_w, current_load_w, input_voltage, output_sockets, model, ip_address, snmp_community, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.name, input.type ?? 'pdu', input.status ?? 'active', input.rack_id ?? null,
      input.power_capacity_w ?? 0, input.current_load_w ?? 0, input.input_voltage ?? 220,
      input.output_sockets ?? 0, input.model ?? '', input.ip_address ?? '',
      input.snmp_community ?? '', input.notes ?? ''
    );
  },

  update(id: string, input: PduUpdateInput): void {
    db.prepare(`
      UPDATE dc_pdus SET name=?, type=?, status=?, rack_id=?, power_capacity_w=?, current_load_w=?,
        input_voltage=?, output_sockets=?, model=?, ip_address=?, snmp_community=?, notes=?,
        updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.name, input.type, input.status, input.rack_id ?? null,
      input.power_capacity_w ?? 0, input.current_load_w ?? 0, input.input_voltage ?? 220,
      input.output_sockets ?? 0, input.model ?? '', input.ip_address ?? '',
      input.snmp_community ?? '', input.notes ?? '', id
    );
  },

  delete(id: string): void {
    db.prepare('DELETE FROM dc_pdus WHERE id = ?').run(id);
  },
};
