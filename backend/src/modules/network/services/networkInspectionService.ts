/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * networkInspectionService 主类（2026-07-21 拆分后精简版）
 *
 * 拆分后行为：
 * - 把原 651 行单类 NetworkInspectionService 拆为：
 *   - inspectionOps.ts（业务编排 + 公开入口 inspectDevice/batchInspect）
 *   - executionOps.ts（3 个 execute*Inspection 私有方法）
 *   - shellOps.ts（connect + executeCommand + shell + extract）
 *   - summaryOps.ts（generateSummary）
 *   - types.ts（类型 barrel）
 *   - index.ts（barrel export 2 公开方法）
 * - 主类保留方法签名 100% 兼容，1-line delegate 转发到子模块
 * - 外部 `import { networkInspectionService } from './networkInspectionService'` 仍兼容
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 *
 * DeviceInfo / InspectionResult / CustomInspectionRequest 类型保留在主类
 * （避免 imports 链断裂；routes 内部使用这些类型）
 */

import type { VendorType, InspectionType } from './vendorAdapter';
import type { ParsedResult } from './networkResultParser';
import { inspectDevice as inspectDeviceFn, batchInspect as batchInspectFn } from './networkInspectionService/inspectionOps';

export interface DeviceInfo {
  id: string;
  name: string;
  ip_address: string;
  vendor: VendorType;
  ssh_port: number;
  username: string;
  password: string;
  enable_password?: string;
}

export interface InspectionResult {
  inspectionId: string;
  deviceId: string;
  inspectionType: 'standard' | 'custom' | 'full';
  status: 'success' | 'partial' | 'failed';
  results: ParsedResult[];
  commandsExecuted: number;
  commandsFailed: number;
  durationMs: number;
  summary: string;
}

export interface CustomInspectionRequest {
  deviceId: string;
  description: string;
  inspectionType: InspectionType[];
}

class NetworkInspectionService {
  /**
   * 单设备巡检
   * 2026-07-21 拆分：委托给 networkInspectionService/inspectionOps
   */
  async inspectDevice(
    deviceId: string,
    inspectionType: 'standard' | 'custom' | 'full' = 'standard',
    customTypes?: InspectionType[],
    customDescription?: string,
  ): Promise<InspectionResult> {
    return inspectDeviceFn(deviceId, inspectionType, customTypes, customDescription);
  }

  /**
   * 批量巡检
   * 2026-07-21 拆分：委托给 networkInspectionService/inspectionOps
   */
  async batchInspect(
    deviceIds: string[],
    inspectionType: 'standard' | 'custom' | 'full' = 'standard',
    customTypes?: InspectionType[],
    customDescription?: string,
  ): Promise<InspectionResult[]> {
    return batchInspectFn(deviceIds, inspectionType, customTypes, customDescription);
  }
}

// 单例导出保留（external consumers 不变）
export const networkInspectionService = new NetworkInspectionService();
