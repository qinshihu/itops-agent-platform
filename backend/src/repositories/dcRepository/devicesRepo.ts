import db from '../../models/database';
import type { DeviceManufacturer, DeviceType, DcDeviceLifecycle, DeviceTypeSlotDefinition } from '../types/dc';

export interface DeviceTypeCreateInput {
  id: string;
  manufacturer_id: string;
  model: string;
  slug: string;
  part_number?: string;
  u_height?: number;
  is_full_depth?: number;
  subdevice_role?: string | null;
  airflow?: string;
  weight_kg?: number | null;
  max_power_w?: number | null;
  description?: string;
}

export type DeviceTypeUpdateInput = DeviceTypeCreateInput;

export interface ManufacturerCreateInput {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  sort_order?: number;
}

export type ManufacturerUpdateInput = ManufacturerCreateInput;

export interface LifecycleCreateInput {
  id: string;
  device_id: string;
  device_type: string;
  action: string;
  from_rack_id?: string | null;
  to_rack_id?: string | null;
  from_slot_start?: number | null;
  from_slot_end?: number | null;
  to_slot_start?: number | null;
  to_slot_end?: number | null;
  notes?: string;
}

export interface LifecycleListFilters {
  action?: string;
  limit?: number;
}

export interface UnallocatedQueryFilters {
  assignedIds: string[];
  search?: string;
}

export const devicesRepo = {
  // ── 制造商 ──

  listManufacturers(): DeviceManufacturer[] {
    return db.prepare('SELECT * FROM device_manufacturers ORDER BY name').all() as DeviceManufacturer[];
  },

  /** 按 sort_order, name 排序（manufacturers.ts 用） */
  listManufacturersOrdered(): DeviceManufacturer[] {
    return db.prepare('SELECT * FROM device_manufacturers ORDER BY sort_order, name').all() as DeviceManufacturer[];
  },

  getManufacturerById(id: string): DeviceManufacturer | undefined {
    return db.prepare('SELECT * FROM device_manufacturers WHERE id = ?').get(id) as DeviceManufacturer | undefined;
  },

  createManufacturer(input: ManufacturerCreateInput): void {
    db.prepare(`
      INSERT INTO device_manufacturers (id, name, slug, description, logo_url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.name, input.slug, input.description ?? '', input.logo_url ?? '', input.sort_order ?? 0);
  },

  updateManufacturer(id: string, input: ManufacturerUpdateInput): void {
    db.prepare(`
      UPDATE device_manufacturers
      SET name=?, slug=?, description=?, logo_url=?, sort_order=?,
          updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(input.name, input.slug, input.description ?? '', input.logo_url ?? '', input.sort_order ?? 0, id);
  },

  deleteManufacturer(id: string): void {
    db.prepare('DELETE FROM device_manufacturers WHERE id = ?').run(id);
  },

  /** 统计某制造商关联的设备型号数（删除前检查） */
  countDeviceTypesByManufacturer(manufacturerId: string): number {
    return (db.prepare('SELECT COUNT(*) as cnt FROM device_types WHERE manufacturer_id = ?').get(manufacturerId) as { cnt: number }).cnt;
  },

  // ── 设备型号 ──

  listDeviceTypes(): DeviceType[] {
    return db.prepare('SELECT * FROM device_types ORDER BY name').all() as DeviceType[];
  },

  /** 设备型号列表 + 制造商名称（deviceTypes.ts GET /） */
  listDeviceTypesWithManufacturer(filters: { manufacturerId?: string } = {}): DeviceType[] {
    const params: unknown[] = [];
    let query = `
      SELECT dt.*, dm.name as manufacturer_name, dm.slug as manufacturer_slug
      FROM device_types dt
      JOIN device_manufacturers dm ON dm.id = dt.manufacturer_id
    `;
    if (filters.manufacturerId) {
      query += ' WHERE dt.manufacturer_id = ?';
      params.push(filters.manufacturerId);
    }
    query += ' ORDER BY dm.name, dt.model';
    return db.prepare(query).all(...params) as DeviceType[];
  },

  /** 单个设备型号 + 制造商信息（deviceTypes.ts GET /:id） */
  getDeviceTypeById(id: string): DeviceType | undefined {
    return db.prepare(`
      SELECT dt.*, dm.name as manufacturer_name, dm.slug as manufacturer_slug
      FROM device_types dt
      JOIN device_manufacturers dm ON dm.id = dt.manufacturer_id
      WHERE dt.id = ?
    `).get(id) as DeviceType | undefined;
  },

  /** 设备型号的槽位定义（device_type_slot_definitions 表） */
  listSlotDefinitions(deviceTypeId: string): DeviceTypeSlotDefinition[] {
    return db.prepare(
      'SELECT * FROM device_type_slot_definitions WHERE device_type_id = ? ORDER BY slot_type, slot_name'
    ).all(deviceTypeId) as DeviceTypeSlotDefinition[];
  },

  getDeviceTypeUHeight(id: string): number | undefined {
    const row = db.prepare('SELECT u_height FROM device_types WHERE id = ?').get(id) as { u_height: number } | undefined;
    return row?.u_height;
  },

  createDeviceType(input: DeviceTypeCreateInput): void {
    db.prepare(`
      INSERT INTO device_types
        (id, manufacturer_id, model, slug, part_number, u_height, is_full_depth,
         subdevice_role, airflow, weight_kg, max_power_w, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.manufacturer_id, input.model, input.slug, input.part_number ?? '',
      input.u_height ?? 1, input.is_full_depth ?? 1, input.subdevice_role ?? null,
      input.airflow ?? 'front-to-rear', input.weight_kg ?? null, input.max_power_w ?? null, input.description ?? ''
    );
  },

  updateDeviceType(id: string, input: DeviceTypeUpdateInput): void {
    db.prepare(`
      UPDATE device_types
      SET manufacturer_id=?, model=?, slug=?, part_number=?, u_height=?, is_full_depth=?,
          subdevice_role=?, airflow=?, weight_kg=?, max_power_w=?, description=?,
          updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(
      input.manufacturer_id, input.model, input.slug, input.part_number ?? '',
      input.u_height ?? 1, input.is_full_depth ?? 1, input.subdevice_role ?? null,
      input.airflow ?? 'front-to-rear', input.weight_kg ?? null, input.max_power_w ?? null,
      input.description ?? '', id
    );
  },

  deleteDeviceType(id: string): void {
    db.prepare('DELETE FROM device_types WHERE id = ?').run(id);
  },

  // ── 生命周期 ──

  listLifecycle(): DcDeviceLifecycle[] {
    return db.prepare('SELECT * FROM dc_device_lifecycle').all() as DcDeviceLifecycle[];
  },

  /** 生命周期列表（带过滤 + 分页，lifecycle.ts GET /） */
  listLifecycleFiltered(filters: LifecycleListFilters = {}): DcDeviceLifecycle[] {
    let query = 'SELECT * FROM dc_device_lifecycle';
    const params: unknown[] = [];
    if (filters.action) {
      query += ' WHERE action = ?';
      params.push(filters.action);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters.limit ?? 500);
    return db.prepare(query).all(...params) as DcDeviceLifecycle[];
  },

  /** 记录生命周期事件（mounted/moved/unmounted） */
  createLifecycle(input: LifecycleCreateInput): void {
    db.prepare(`
      INSERT INTO dc_device_lifecycle (id, device_id, device_type, action,
        from_rack_id, to_rack_id, from_slot_start, from_slot_end, to_slot_start, to_slot_end, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id, input.device_id, input.device_type, input.action,
      input.from_rack_id ?? null, input.to_rack_id ?? null,
      input.from_slot_start ?? null, input.from_slot_end ?? null,
      input.to_slot_start ?? null, input.to_slot_end ?? null,
      input.notes ?? ''
    );
  },

  // ── 未分配设备查询（devices.ts /unallocated）──

  /** 未分配的服务器（不在 dc_rack_slots 中的 servers） */
  listUnallocatedServers(filters: UnallocatedQueryFilters): Array<Record<string, unknown>> {
    return buildUnallocatedQuery('servers', 'id, name, ip_address, enabled, cpu_cores, memory_gb', 'server', filters);
  },

  /** 未分配的网络设备 */
  listUnallocatedNetworkDevices(filters: UnallocatedQueryFilters): Array<Record<string, unknown>> {
    return buildUnallocatedQuery('network_devices', 'id, name, ip_address, status', 'network_device', filters);
  },

  /** 未分配的虚拟机 */
  listUnallocatedVms(filters: UnallocatedQueryFilters): Array<Record<string, unknown>> {
    return buildUnallocatedQuery('virtual_machines', 'id, name, status, cpu_cores, memory_mb', 'vm_host', filters);
  },
};

/**
 * 构造 "未分配设备" 查询：从指定表选出不在 assignedIds 中的设备
 * 保留与 devices.ts buildUnallocatedQuery 完全一致的语义
 */
function buildUnallocatedQuery(table: string, cols: string, type: string, filters: UnallocatedQueryFilters): Array<Record<string, unknown>> {
  const params: unknown[] = [];
  let query = `SELECT ${cols}, ? as device_type FROM ${table}`;
  params.push(type);
  if (filters.assignedIds.length > 0) {
    const idSet = filters.assignedIds.map(() => '?').join(',');
    query += ` WHERE id NOT IN (${idSet})`;
    params.push(...filters.assignedIds);
  }
  if (filters.search) {
    query += (filters.assignedIds.length > 0 ? ' AND' : ' WHERE') + ' (name LIKE ? OR ip_address LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  query += ' ORDER BY name LIMIT 200';
  return db.prepare(query).all(...params) as Array<Record<string, unknown>>;
}
