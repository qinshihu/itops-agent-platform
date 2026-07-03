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
  [key: string]: unknown;
}

export interface DcDeviceRecord {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface DcPduRecord {
  id: string;
  [key: string]: unknown;
}

export interface DcCableRecord {
  id: string;
  [key: string]: unknown;
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
  [key: string]: unknown;
}
