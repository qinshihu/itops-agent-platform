// backend/src/repositories/types/dc.ts
// 来源: v028 + v029 + v030 + v032 + v033 + v034 + v035 + v036 + v037 + v041

/** 机房 — v028 dc_rooms + v030 + v041 ALTER */
export interface DcRoom {
  id: string;
  name: string;
  label: string;
  description: string;
  width_m: number;
  depth_m: number;
  max_temperature: number;
  min_temperature: number;
  max_humidity: number;
  min_humidity: number;
  layout_config: string;             // JSON string
  sort_order: number;
  current_temperature: number | null;  // v030 ALTER
  current_humidity: number | null;     // v030 ALTER
  pue: number;                         // v041 ALTER
  total_power_kw: number;              // v041 ALTER
  created_at: string;
  updated_at: string;
}

/** 机架 — v028 dc_racks */
export interface DcRack {
  id: string;
  room_id: string;
  name: string;
  label: string;
  row_number: number;
  position_x: number;
  position_z: number;
  total_u: number;
  pdu_count: number;
  max_power_w: number;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 机架槽位 — v028 dc_rack_slots + v033 ALTER (device_type_id) */
export interface DcRackSlot {
  id: string;
  rack_id: string;
  device_id: string;
  device_type: string;
  start_u: number;
  end_u: number;
  position_face: string;
  notes: string;
  device_type_id: string | null;     // v033 ALTER
  created_at: string;
  updated_at: string;
}

/** 设备生命周期 — v029 dc_device_lifecycle */
export interface DcDeviceLifecycle {
  id: string;
  device_id: string;
  device_type: string;
  action: string;
  from_rack_id: string | null;
  from_slot_start: number | null;
  from_slot_end: number | null;
  to_rack_id: string | null;
  to_slot_start: number | null;
  to_slot_end: number | null;
  performed_by: string;
  notes: string;
  created_at: string;
}

/** PDU — v029 dc_pdus */
export interface DcPdu {
  id: string;
  name: string;
  rack_id: string | null;
  type: string;
  status: string;
  model: string;
  power_capacity_w: number;
  current_load_w: number;
  input_voltage: number;
  output_sockets: number;
  ip_address: string;
  snmp_community: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/** 设备制造商 — v032 device_manufacturers */
export interface DeviceManufacturer {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 设备型号 — v033 device_types */
export interface DeviceType {
  id: string;
  manufacturer_id: string;
  model: string;
  slug: string;
  part_number: string;
  u_height: number;
  is_full_depth: number;
  subdevice_role: string | null;
  airflow: string;
  weight_kg: number | null;
  max_power_w: number | null;
  front_image_url: string;
  rear_image_url: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/** 设备型号槽位定义 — v034 device_type_slot_definitions */
export interface DeviceTypeSlotDefinition {
  id: string;
  device_type_id: string;
  slot_type: string;
  slot_name: string;
  slot_label: string;
  position_label: string;
  u_position: number;
  is_preferred: number;
  created_at: string;
}

/** 电力面板 — v035 dc_power_panels */
export interface DcPowerPanel {
  id: string;
  room_id: string;
  name: string;
  location_label: string;
  panel_type: string;
  voltage: number;
  amperage: number;
  phase_count: number;
  max_power_kw: number;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** 电力馈送 — v036 dc_power_feeds */
export interface DcPowerFeed {
  id: string;
  power_panel_id: string;
  rack_id: string | null;
  name: string;
  status: string;
  feed_type: string;
  supply: string;
  voltage: number;
  amperage: number;
  max_utilization_pct: number;
  current_load_w: number;
  description: string;
  created_at: string;
  updated_at: string;
}

/** 线缆 — v037 dc_cables */
export interface DcCable {
  id: string;
  name: string;
  cable_type: string;
  cable_color: string;
  length_m: number | null;
  status: string;
  a_device_id: string;
  a_device_type: string;
  a_port_name: string;
  b_device_id: string;
  b_device_type: string;
  b_port_name: string;
  description: string;
  created_at: string;
  updated_at: string;
}
