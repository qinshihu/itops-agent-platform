export interface NetworkDevice {
  id: string;
  name: string;
  ip_address: string;
  vendor: string;
  model?: string;
  os_version?: string;
  ssh_port: number;
  username: string;
  location?: string;
  role?: string;
  status: string;
  last_inspection_at?: string;
  last_inspection_result?: string;
  created_at: string;
  updated_at: string;
  snmp_enabled?: number;
  snmp_credential_id?: string;
  snmp_credential_name?: string;
}

export interface InspectionResultData {
  _deviceName?: string;
  inspectionId: string;
  deviceId: string;
  inspectionType: 'standard' | 'custom' | 'full';
  status: 'success' | 'partial' | 'failed';
  results: Array<{
    type: string;
    success: boolean;
    value?: number | string;
    unit?: string;
    status: 'normal' | 'warning' | 'critical' | 'error';
    details: string;
    rawOutput: string;
    timestamp: string;
  }>;
  commandsExecuted: number;
  commandsFailed: number;
  durationMs: number;
  summary: string;
  [key: string]: unknown;
}

export interface SnmpInterfaceMetric {
  index: number;
  name: string;
  operStatus: 'up' | 'down';
  adminStatus: 'up' | 'down';
  speed: number;
  mtu: number;
  mac: string;
  inBps: number;
  outBps: number;
  inUtilization: number;
  outUtilization: number;
  inErrors: number;
  outErrors: number;
}

export interface SnmpInspectionData {
  _deviceName?: string;
  reachable: boolean;
  sysName: string;
  sysDescr: string;
  sysUptime: number;
  interfaces: SnmpInterfaceMetric[];
  interfaceCount: number;
  upCount: number;
  downCount: number;
  alerts: string[];
  pollDurationMs: number;
  [key: string]: unknown;
}

export interface TimelineItem {
  id?: string;
  device_id?: string;
  source?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface DeviceTimelineEntry {
  lastAnalysis?: TimelineItem;
  lastInspection?: TimelineItem;
  lastExecution?: TimelineItem;
}

export const VENDORS = ['all', 'huawei', 'cisco', 'h3c', 'ruijie', 'zte'];

export const VENDOR_LABELS: Record<string, string> = {
  all: '全部厂商',
  huawei: '华为',
  cisco: '思科',
  h3c: '华三',
  ruijie: '锐捷',
  zte: '中兴',
};