/**
 * DC 模块 API 服务层
 * 封装数据中心机房、机柜、机位、PDU、制造商、设备型号、配电柜、供电线路、线缆相关端点
 */

import api from '@/lib/api';
import type { DcRoom as _DcRoom, DcRack as _DcRack, DcRackSlot as _DcRackSlot } from '../../types/dc';

// ============================================================
// 类型定义
// ============================================================

// ── 机房 ──

export interface Room {
  id: string;
  name: string;
  label?: string;
  width_m?: number;
  depth_m?: number;
  description?: string;
  sort_order?: number;
}

export interface RoomInput {
  name: string;
  label?: string;
  width_m?: number;
  depth_m?: number;
  description?: string;
  sort_order?: number;
}

// ── 机柜 ──

export interface Rack {
  id: string;
  name: string;
  room_id: string;
  row_number?: number;
  total_u: number;
  used_u: number;
  device_count?: number;
  status?: string;
  position_x?: number;
  position_z?: number;
  sort_order?: number;
  room_name?: string;
  room_label?: string;
}

export interface RackInput {
  name: string;
  room_id: string;
  row_number?: number;
  total_u: number;
  position_x?: number;
  position_z?: number;
  sort_order?: number;
}

// ── 机位 ──

export interface Slot {
  id: string;
  rack_id: string;
  device_id?: string | null;
  device_name?: string;
  device_type?: string;
  device_status?: string;
  server_status?: string;
  start_u: number;
  end_u: number;
  position_face?: string;
  cpu_usage?: number;
  memory_usage?: number;
  os_type?: string;
  ip_address?: string;
  [key: string]: unknown;
}

export interface SlotInput {
  rack_id?: string;
  device_id?: string;
  start_u: number;
  end_u: number;
  position_face?: string;
}

// ── PDU ──

export interface PDU {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  rack_id?: string;
  rack_name?: string;
  power_capacity_w?: number;
  current_load_w?: number;
  input_voltage?: number;
  output_sockets?: number;
  model?: string;
  ip_address?: string;
  snmp_community?: string;
  notes?: string;
}

export interface PduInput {
  name: string;
  type?: string;
  status?: string;
  rack_id?: string;
  power_capacity_w?: number;
  current_load_w?: number;
  input_voltage?: number;
  output_sockets?: number;
  model?: string;
  ip_address?: string;
  snmp_community?: string;
  notes?: string;
}

// ── 生命周期 ──

export interface LifecycleRecord {
  id: string;
  created_at?: string;
  action?: string;
  device_type?: string;
  from_location?: string;
  to_location?: string;
  performed_by?: string;
  notes?: string;
}

export interface LifecycleParams {
  action?: string;
  device_type?: string;
}

// ── 概览 ──

export interface OverviewSummary {
  totalRooms?: number;
  totalRacks?: number;
  totalDevices?: number;
  onlineDevices?: number;
  alertDevices?: number;
  offlineDevices?: number;
  avgTemp?: number;
  avgHumidity?: number;
}

export interface OverviewData {
  summary?: OverviewSummary;
  rackData?: unknown[];
  rooms?: unknown[];
  isEmpty?: boolean;
  isPartialMock?: boolean;
  pue?: number;
  totalPowerKw?: number;
}

// ── 设备 ──

export interface DcDevice {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

// ── NetBox 资源（制造商/型号/配电/线缆） ──

export interface Manufacturer {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ManufacturerInput {
  name: string;
  slug?: string;
  description?: string;
  logo_url?: string;
  sort_order?: number;
}

export interface DeviceType {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface DeviceTypeInput {
  manufacturer_id: string;
  model: string;
  slug?: string;
  part_number?: string;
  u_height?: number;
  is_full_depth?: boolean;
  weight_kg?: number;
  description?: string;
  power_consumption_w?: number;
  airflow?: 'front-to-rear' | 'rear-to-front' | 'side-to-side' | 'passive';
}

export interface PowerPanel {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface PowerPanelInput {
  room_id: string;
  name: string;
  location_label?: string;
  panel_type?: 'primary' | 'redundant' | 'transfer' | 'subpanel';
  voltage?: number;
  amperage?: number;
  phase_count?: number;
  description?: string;
  sort_order?: number;
}

export interface PowerFeed {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface PowerFeedInput {
  power_panel_id: string;
  rack_id?: string;
  name: string;
  status?: 'active' | 'planned' | 'offline' | 'fault';
  feed_type?: 'primary' | 'redundant' | 'single';
  supply?: 'ac' | 'dc';
  voltage?: number;
  amperage?: number;
  max_utilization_pct?: number;
  current_load_w?: number;
  description?: string;
}

export interface Cable {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface CableInput {
  name?: string;
  cable_type: string;
  cable_color?: string;
  length_m?: number;
  status?: 'connected' | 'planned' | 'decommissioned' | 'fault';
  a_device_id: string;
  a_device_type?: string;
  a_port_name?: string;
  b_device_id: string;
  b_device_type?: string;
  b_port_name?: string;
  description?: string;
}

// ============================================================
// dcApi 对象
// ============================================================

export const dcApi = {
  // ── 概览与批量加载 ──

  /** 获取概览数据 */
  async getOverview(): Promise<OverviewData> {
    const { data } = await api.get('/dc/overview');
    return data.data;
  },

  /** 获取所有设备列表 */
  async listDevices(): Promise<DcDevice[]> {
    const { data } = await api.get('/dc/devices');
    return data.data;
  },

  /** 获取未分配设备列表 */
  async listUnallocatedDevices(): Promise<DcDevice[]> {
    const { data } = await api.get('/dc/devices/unallocated');
    return data.data;
  },

  /** 获取生命周期记录 */
  async listLifecycles(params?: LifecycleParams): Promise<LifecycleRecord[]> {
    const { data } = await api.get('/dc/lifecycle', { params });
    return data.data;
  },

  /** 获取导出数据（JSON） */
  async getExportData(): Promise<unknown> {
    const { data } = await api.get('/dc/export');
    return data.data;
  },

  /** 导出数据（Blob） */
  async exportBlob(): Promise<Blob> {
    const { data } = await api.get('/dc/export', { responseType: 'blob' });
    return data;
  },

  /** 导入数据 */
  async importData(input: { data: unknown }): Promise<unknown> {
    const { data } = await api.post('/dc/import', input);
    return data;
  },

  // ── 机房 ──

  /** 获取机房列表 */
  async listRooms(): Promise<Room[]> {
    const { data } = await api.get('/dc/rooms');
    return data.data;
  },

  /** 创建机房 */
  async createRoom(input: RoomInput): Promise<Room> {
    const { data } = await api.post('/dc/rooms', input);
    return data.data;
  },

  /** 更新机房 */
  async updateRoom(id: string, input: RoomInput): Promise<Room> {
    const { data } = await api.put(`/dc/rooms/${id}`, input);
    return data.data;
  },

  /** 删除机房 */
  async deleteRoom(id: string): Promise<void> {
    await api.delete(`/dc/rooms/${id}`);
  },

  // ── 机柜 ──

  /** 获取机柜列表 */
  async listRacks(): Promise<Rack[]> {
    const { data } = await api.get('/dc/racks');
    return data.data;
  },

  /** 创建机柜 */
  async createRack(input: RackInput): Promise<Rack> {
    const { data } = await api.post('/dc/racks', input);
    return data.data;
  },

  /** 更新机柜 */
  async updateRack(id: string, input: RackInput): Promise<Rack> {
    const { data } = await api.put(`/dc/racks/${id}`, input);
    return data.data;
  },

  /** 删除机柜 */
  async deleteRack(id: string): Promise<void> {
    await api.delete(`/dc/racks/${id}`);
  },

  // ── 机位 ──

  /** 获取机柜的机位列表 */
  async listSlots(rackId: string): Promise<Slot[]> {
    const { data } = await api.get(`/dc/slots/${rackId}`);
    return data.data;
  },

  /** 创建/分配机位 */
  async createSlot(input: SlotInput): Promise<Slot> {
    const { data } = await api.post('/dc/slots', input);
    return data.data;
  },

  /** 更新机位 */
  async updateSlot(id: string, input: Partial<SlotInput>): Promise<Slot> {
    const { data } = await api.put(`/dc/slots/${id}`, input);
    return data.data;
  },

  /** 删除机位 */
  async deleteSlot(id: string): Promise<void> {
    await api.delete(`/dc/slots/${id}`);
  },

  // ── PDU ──

  /** 获取 PDU 列表 */
  async listPdus(): Promise<PDU[]> {
    const { data } = await api.get('/dc/pdus');
    return data.data;
  },

  /** 创建 PDU */
  async createPdu(input: PduInput): Promise<PDU> {
    const { data } = await api.post('/dc/pdus', input);
    return data.data;
  },

  /** 更新 PDU */
  async updatePdu(id: string, input: PduInput): Promise<PDU> {
    const { data } = await api.put(`/dc/pdus/${id}`, input);
    return data.data;
  },

  /** 删除 PDU */
  async deletePdu(id: string): Promise<void> {
    await api.delete(`/dc/pdus/${id}`);
  },

  // ── 制造商 ──

  /** 获取制造商列表 */
  async listManufacturers(): Promise<Manufacturer[]> {
    const { data } = await api.get('/dc/manufacturers');
    return data.data;
  },

  /** 创建制造商 */
  async createManufacturer(input: ManufacturerInput): Promise<Manufacturer> {
    const { data } = await api.post('/dc/manufacturers', input);
    return data.data;
  },

  /** 更新制造商 */
  async updateManufacturer(id: string, input: ManufacturerInput): Promise<Manufacturer> {
    const { data } = await api.put(`/dc/manufacturers/${id}`, input);
    return data.data;
  },

  /** 删除制造商 */
  async deleteManufacturer(id: string): Promise<void> {
    await api.delete(`/dc/manufacturers/${id}`);
  },

  // ── 设备型号 ──

  /** 获取设备型号列表 */
  async listDeviceTypes(): Promise<DeviceType[]> {
    const { data } = await api.get('/dc/device-types');
    return data.data;
  },

  /** 创建设备型号 */
  async createDeviceType(input: DeviceTypeInput): Promise<DeviceType> {
    const { data } = await api.post('/dc/device-types', input);
    return data.data;
  },

  /** 更新设备型号 */
  async updateDeviceType(id: string, input: DeviceTypeInput): Promise<DeviceType> {
    const { data } = await api.put(`/dc/device-types/${id}`, input);
    return data.data;
  },

  /** 删除设备型号 */
  async deleteDeviceType(id: string): Promise<void> {
    await api.delete(`/dc/device-types/${id}`);
  },

  // ── 配电柜 ──

  /** 获取配电柜列表 */
  async listPowerPanels(): Promise<PowerPanel[]> {
    const { data } = await api.get('/dc/power-panels');
    return data.data;
  },

  /** 创建配电柜 */
  async createPowerPanel(input: PowerPanelInput): Promise<PowerPanel> {
    const { data } = await api.post('/dc/power-panels', input);
    return data.data;
  },

  /** 更新配电柜 */
  async updatePowerPanel(id: string, input: PowerPanelInput): Promise<PowerPanel> {
    const { data } = await api.put(`/dc/power-panels/${id}`, input);
    return data.data;
  },

  /** 删除配电柜 */
  async deletePowerPanel(id: string): Promise<void> {
    await api.delete(`/dc/power-panels/${id}`);
  },

  // ── 供电线路 ──

  /** 获取供电线路列表 */
  async listPowerFeeds(): Promise<PowerFeed[]> {
    const { data } = await api.get('/dc/power-feeds');
    return data.data;
  },

  /** 创建供电线路 */
  async createPowerFeed(input: PowerFeedInput): Promise<PowerFeed> {
    const { data } = await api.post('/dc/power-feeds', input);
    return data.data;
  },

  /** 更新供电线路 */
  async updatePowerFeed(id: string, input: PowerFeedInput): Promise<PowerFeed> {
    const { data } = await api.put(`/dc/power-feeds/${id}`, input);
    return data.data;
  },

  /** 删除供电线路 */
  async deletePowerFeed(id: string): Promise<void> {
    await api.delete(`/dc/power-feeds/${id}`);
  },

  // ── 线缆 ──

  /** 获取线缆列表 */
  async listCables(): Promise<Cable[]> {
    const { data } = await api.get('/dc/cables');
    return data.data;
  },

  /** 创建线缆 */
  async createCable(input: CableInput): Promise<Cable> {
    const { data } = await api.post('/dc/cables', input);
    return data.data;
  },

  /** 更新线缆 */
  async updateCable(id: string, input: Partial<CableInput>): Promise<Cable> {
    const { data } = await api.put(`/dc/cables/${id}`, input);
    return data.data;
  },

  /** 删除线缆 */
  async deleteCable(id: string): Promise<void> {
    await api.delete(`/dc/cables/${id}`);
  },
};

export default dcApi;
