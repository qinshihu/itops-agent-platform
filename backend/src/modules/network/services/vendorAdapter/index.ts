/**
 * 厂商适配器 — 入口模块
 *
 * 重新导出类型与辅助函数，注册所有厂商适配器，并提供工厂函数。
 */

import { logger } from '../../../../utils/logger';

// 重新导出所有类型
export type { VendorType, DeviceType, InspectionType, CommandTemplate, VendorAdapter } from './types';

// 导入所有厂商适配器
import { HuaweiAdapter } from './huawei';
import { CiscoAdapter } from './cisco';
import { H3cAdapter } from './h3c';
import { RuijieAdapter } from './ruijie';
import { ZteAdapter } from './zte';
import { FortinetAdapter } from './fortinet';
import { PaloAltoAdapter } from './paloalto';
import { JuniperAdapter } from './juniper';
import { AristaAdapter } from './arista';
import { HpeAdapter } from './hpe';
import { MikrotikAdapter } from './mikrotik';
import { UbiquitiAdapter } from './ubiquiti';
import { DellAdapter } from './dell';
import { TplinkAdapter } from './tplink';
import { F5Adapter } from './f5';
import { RuijieEgAdapter } from './ruijie_eg';

import type { VendorType, VendorAdapter, InspectionType } from './types';

// ====================================================================
// Factory：按厂商名称创建适配器实例
// ====================================================================

const adapterRegistry: Record<VendorType, new () => VendorAdapter> = {
  huawei: HuaweiAdapter,
  cisco: CiscoAdapter,
  h3c: H3cAdapter,
  ruijie: RuijieAdapter,
  zte: ZteAdapter,
  fortinet: FortinetAdapter,
  paloalto: PaloAltoAdapter,
  juniper: JuniperAdapter,
  arista: AristaAdapter,
  hpe: HpeAdapter,
  mikrotik: MikrotikAdapter,
  ubiquiti: UbiquitiAdapter,
  dell: DellAdapter,
  tplink: TplinkAdapter,
  f5: F5Adapter,
  ruijie_eg: RuijieEgAdapter,
};

export function createVendorAdapter(vendor: VendorType): VendorAdapter {
  const AdapterClass = adapterRegistry[vendor];
  if (!AdapterClass) {
    logger.warn(`Unknown vendor: ${vendor}, falling back to Huawei adapter`);
    return new HuaweiAdapter();
  }
  return new AdapterClass();
}

// ====================================================================
// 所有标准巡检维度（全量）
// ====================================================================

export const STANDARD_INSPECTION_TYPES: InspectionType[] = [
  'cpu',
  'memory',
  'interface',
  'version',
  'routes',
  'log',
  'environment',
  'power',
  'fan',
  'stp',
  'vlan',
  'arp',
  'mac',
  // 新增维度
  'optic',
  'neighbor',
  'security_policy',
  'nat',
  'session',
  'vpn',
  'wlan',
  'pool',
  'dns',
  'bgp',
  'ospf',
  'ntp',
  'license',
  'config_checksum',
];
