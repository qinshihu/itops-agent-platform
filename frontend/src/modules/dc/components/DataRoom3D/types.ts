/* ========== 机房 3D 类型定义 ========== */

/** 机柜 3D 数据 */
export interface Rack3D {
  id: string;
  name: string;
  roomName: string;
  roomLabel: string;
  row: number;
  totalU: number;
  usedU: number;
  deviceCount: number;
  alertCount: number;
  deviceStatus: string;
  /** 3D 场景 X 坐标 */
  sceneX?: number;
  /** 3D 场景 Z 坐标 */
  sceneZ?: number;
}

/** 机柜 U 位设备 */
export interface SlotInfo {
  id: string;
  startU: number;
  endU: number;
  deviceName: string;
  deviceType: string;
  deviceStatus: string | null;
  cpuUsage: number | null;
  memUsage: number | null;
  diskUsage: number | null;
}

/** 线缆连接（用于 3D 拓扑渲染） */
export interface CableData {
  id: string;
  a_device_id: string;
  a_device_type: string;
  a_port_name: string;
  b_device_id: string;
  b_device_type: string;
  b_port_name: string;
  cable_type: string;
  cable_color: string;
  status: string;
  /** 父组件预计算好的 A 端 3D 坐标 */
  a_position: [number, number, number];
  /** 父组件预计算好的 B 端 3D 坐标 */
  b_position: [number, number, number];
}

/** 概览统计 */
export interface OverviewSummary {
  totalDevices: number;
  onlineDevices: number;
  alertDevices: number;
  offlineDevices: number;
  avgTemp: number;
  avgHumidity: number;
  totalRacks: number;
}

export interface OverviewData {
  summary: OverviewSummary;
  pue?: number;
  totalPower?: number;
  coolingPower?: number;
  itPower?: number;
  rackData?: Rack3D[];
  [key: string]: unknown;
}

/** 告警项 */
export interface AlertItem {
  id: string;
  title: string;
  severity: string;
  source?: string;
  time?: string;
}
