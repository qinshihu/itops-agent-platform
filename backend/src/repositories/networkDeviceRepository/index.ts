/**
 * networkDeviceRepository — 统一数据访问层（桶导出）
 *
 * 本文件将子仓库组装为原始 networkDeviceRepository 对象，保持对外 API 不变。
 * 所有调用方无需修改 import 路径。
 */

import { networkDeviceCoreRepo } from './core';
import { networkDeviceDiscoveryRepo } from './discovery';
import { networkDeviceLldpRepo } from './lldp';

export const networkDeviceRepository = {
  ...networkDeviceCoreRepo,
  ...networkDeviceDiscoveryRepo,
  ...networkDeviceLldpRepo,
};

// 类型重导出
export type {
  NetworkDeviceRecord,
  NetworkDeviceWithCredentialName,
  NetworkDeviceCredentials,
  NetworkDeviceSshCredentials,
  NetworkDeviceBasic,
  NetworkDeviceCreateInput,
  NetworkDeviceUpdateInput,
  NetworkDeviceDiscoveryInput,
} from './types';