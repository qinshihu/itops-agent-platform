/** dcRepository 共享类型 */

export interface DcRackRecord {
  id: string;
  name: string;
  room_id: string;
  row_number?: number;
  total_u?: number;
  status?: string;
  sort_order?: number;
  position_x?: number;
  position_z?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DcDeviceRecord {
  id: string;
  name?: string;
}

export interface DcPduRecord {
  id: string;
}

export interface DcCableRecord {
  id: string;
}

export interface DcRackCreateInput {
  id: string;
  name: string;
  room_id: string;
  row_number?: number;
  total_u?: number;
  sort_order?: number;
  position_x?: number;
  position_z?: number;
}

export interface DcDeviceCreateInput {
  id: string;
  name?: string;
}
