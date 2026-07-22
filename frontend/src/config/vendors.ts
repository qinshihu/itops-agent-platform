/**
 * 厂商列表 — 前后端共享单一数据源
 *
 * 新增厂商只需修改此文件一处即可。设备列表页筛选、添加设备弹窗、
 * 其他可能用到厂商选择的地方都从此处导入。
 */

export interface VendorOption {
  /** 厂商标识（与后端 VendorType 一致） */
  value: string;
  /** 显示标签（中文/英文混排，适配 UI） */
  label: string;
}

/** 完整厂商列表（顺序：主流厂商 → 通用/小众厂商，'all' 仅前端筛选用） */
export const VENDORS: VendorOption[] = [
  { value: 'all', label: '全部厂商' },
  { value: 'huawei', label: '华为 (Huawei)' },
  { value: 'cisco', label: '思科 (Cisco)' },
  { value: 'h3c', label: '华三 (H3C)' },
  { value: 'ruijie', label: '锐捷 (Ruijie)' },
  { value: 'zte', label: '中兴 (ZTE)' },
  { value: 'fortinet', label: 'Fortinet' },
  { value: 'paloalto', label: 'Palo Alto' },
  { value: 'juniper', label: 'Juniper' },
  { value: 'arista', label: 'Arista' },
  { value: 'hpe', label: 'HPE' },
  { value: 'mikrotik', label: 'MikroTik' },
  { value: 'ubiquiti', label: 'Ubiquiti' },
  { value: 'dell', label: 'Dell' },
  { value: 'tplink', label: 'TP-Link' },
  { value: 'f5', label: 'F5' },
  { value: 'ruijie_eg', label: '锐捷EG (Ruijie EG)' },
  { value: 'panabit', label: 'Panabit (流控网关)' },
];

/** 简化的厂商 value 列表（向后兼容旧代码用 VENDORS 字符串数组的地方） */
export const VENDOR_VALUES: string[] = VENDORS.map(v => v.value);

/** 厂商 value → 标签的查找表 */
export const VENDOR_LABELS: Record<string, string> = Object.fromEntries(
  VENDORS.map(v => [v.value, v.label])
);

/** 设备录入时可选的厂商（不含 'all'） */
export const DEVICE_VENDORS: VendorOption[] = VENDORS.filter(v => v.value !== 'all');
