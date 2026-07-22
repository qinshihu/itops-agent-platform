/**
 * networkInspectionService 主流程子模块（2026-07-21 拆分）
 *
 * 把主类 2 个公开入口方法抽为模块级纯函数：
 * - inspectDevice（单设备巡检流程编排）
 * - batchInspect（批量巡检）
 *
 * 通过 executionOps/summaryOps + shellOps 组合
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { networkDeviceRepository, snmpInspectionRepo } from '../../../../repositories';
import { decrypt } from '../../../auth/services/encryptionService';
import type { ParsedResult } from '../networkResultParser';
import type { DeviceInfo, InspectionResult } from '../networkInspectionService';
import type { InspectionType } from '../vendorAdapter';
import {
  executeStandardInspection,
  executeCustomInspection,
  executeCustomDescriptionInspection,
} from './executionOps';
import { generateSummary } from './summaryOps';

/** 单设备巡检（公开入口） */
export async function inspectDevice(
  deviceId: string,
  inspectionType: 'standard' | 'custom' | 'full' = 'standard',
  customTypes?: InspectionType[],
  customDescription?: string,
): Promise<InspectionResult> {
  const startTime = Date.now();
  const inspectionId = randomUUID();

  const device = networkDeviceRepository.getFullCredentials(deviceId) as DeviceInfo | undefined;

  if (!device) {
    throw new Error(`Device not found: ${deviceId}`);
  }

  const decryptedDevice: DeviceInfo = {
    ...device,
    password: decrypt(device.password || ''),
    enable_password: device.enable_password ? decrypt(device.enable_password) : undefined,
  };

  snmpInspectionRepo.createRunning({
    id: inspectionId,
    device_id: deviceId,
    inspection_type: inspectionType,
    status: 'running',
  });

  try {
    const results: ParsedResult[] = [];
    let commandsExecuted = 0;
    let commandsFailed = 0;

    if (inspectionType === 'standard' || inspectionType === 'full') {
      const standardResults = await executeStandardInspection(decryptedDevice);
      results.push(...standardResults);
      commandsExecuted += standardResults.length;
      commandsFailed += standardResults.filter((r) => r.status === 'error').length;
    }

    if ((inspectionType === 'custom' || inspectionType === 'full') && customTypes && customTypes.length > 0) {
      const customResults = await executeCustomInspection(decryptedDevice, customTypes);
      results.push(...customResults);
      commandsExecuted += customResults.length;
      commandsFailed += customResults.filter((r) => r.status === 'error').length;
    }

    if (inspectionType === 'custom' && customDescription) {
      const customResults = await executeCustomDescriptionInspection(decryptedDevice, customDescription);
      results.push(...customResults);
      commandsExecuted += customResults.length;
      commandsFailed += customResults.filter((r) => r.status === 'error').length;
    }

    const durationMs = Date.now() - startTime;
    const status =
      commandsFailed === 0 ? 'success' : commandsFailed < commandsExecuted / 2 ? 'partial' : 'failed';
    const summary = generateSummary(results);

    snmpInspectionRepo.updateResult(inspectionId, {
      status,
      commands_executed: commandsExecuted,
      commands_failed: commandsFailed,
      results: JSON.stringify(results),
      summary,
      duration_ms: durationMs,
    });

    networkDeviceRepository.updateInspectionResult(deviceId, summary);

    return {
      inspectionId,
      deviceId,
      inspectionType,
      status,
      results,
      commandsExecuted,
      commandsFailed,
      durationMs,
      summary,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    snmpInspectionRepo.updateFailed(inspectionId, errorMessage, durationMs);

    logger.error(`Inspection failed for device ${deviceId}: ${errorMessage}`);

    return {
      inspectionId,
      deviceId,
      inspectionType,
      status: 'failed',
      results: [],
      commandsExecuted: 0,
      commandsFailed: 0,
      durationMs,
      summary: errorMessage,
    };
  }
}

/** 批量巡检（公开入口） */
export async function batchInspect(
  deviceIds: string[],
  inspectionType: 'standard' | 'custom' | 'full' = 'standard',
  customTypes?: InspectionType[],
  customDescription?: string,
): Promise<InspectionResult[]> {
  const results: InspectionResult[] = [];

  for (const deviceId of deviceIds) {
    try {
      const result = await inspectDevice(deviceId, inspectionType, customTypes, customDescription);
      results.push(result);
    } catch (error) {
      logger.error(
        `Batch inspection failed for device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  return results;
}
