/* ==================== 常量 ==================== */

export const deviceTypeColors: Record<string, string> = {
  server: 'blue',
  network_device: 'purple',
  vm_host: 'cyan',
  pdu: 'orange',
  ups: 'gold',
  other: 'default',
};

export const actionColors: Record<string, string> = {
  mounted: 'green',
  unmounted: 'red',
  moved: 'blue',
  maintenance: 'orange',
};

export const typeLabelMap: Record<string, string> = {
  server: '服务器',
  network_device: '网络设备',
  vm_host: '虚拟机',
  pdu: 'PDU',
  ups: 'UPS',
  other: '其他',
};

export const typeColorMap: Record<string, string> = {
  server: 'blue',
  network_device: 'purple',
  vm_host: 'cyan',
  pdu: 'orange',
  ups: 'gold',
  other: 'default',
};

/* ==================== 类型 ==================== */

export interface Room {
  id: string;
  name: string;
  label?: string;
  width_m?: number;
  depth_m?: number;
  description?: string;
  sort_order?: number;
}

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
  [key: string]: any;
}

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
  rackData?: any[];
  rooms?: any[];
  isEmpty?: boolean;
  isPartialMock?: boolean;
  pue?: number;
  totalPowerKw?: number;
}
