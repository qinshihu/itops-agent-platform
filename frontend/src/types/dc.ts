// frontend/src/types/dc.ts
// 与后端 backend/src/repositories/types/dc.ts 对应

export interface DcRoom {
  id: string;
  name: string;
  label: string;
  description: string;
  width_m: number;
  depth_m: number;
  layout_config: string;
  sort_order: number;
  current_temperature: number | null;
  current_humidity: number | null;
  pue: number;
  total_power_kw: number;
  created_at: string;
  updated_at: string;
}

export interface DcRack {
  id: string;
  room_id: string;
  name: string;
  label: string;
  row_number: number;
  position_x: number;
  position_z: number;
  total_u: number;
  max_power_w: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DcRackSlot {
  id: string;
  rack_id: string;
  device_id: string;
  device_type: string;
  device_type_id: string | null;
  start_u: number;
  end_u: number;
  position_face: string;
}

export interface DcDeviceType {
  id: string;
  manufacturer_id: string;
  model: string;
  u_height: number;
  is_full_depth: number;
  airflow: string;
  description: string;
}

export interface DcPowerPanel {
  id: string;
  room_id: string;
  name: string;
  panel_type: string;
  voltage: number;
  amperage: number;
  max_power_kw: number;
  created_at: string;
}

export interface DcCable {
  id: string;
  name: string;
  cable_type: string;
  cable_color: string;
  length_m: number | null;
  status: string;
  a_device_id: string;
  a_port_name: string;
  b_device_id: string;
  b_port_name: string;
}
