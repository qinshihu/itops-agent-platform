/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 修复后验证与记录管理
 * 从 configRepairService.ts 提取的修复记录 CRUD 操作
 */

import { logger } from '../../../../utils/logger';
import type { RepairRecord } from '../../../../types/configRepair';
import { configRepairRecordsRepo } from '../../../../repositories/configRepository';

/**
 * 获取修复记录
 */
export function getRepairRecord(recordId: string): RepairRecord | null {
  try {
    const row = configRepairRecordsRepo.getById(recordId);
    if (!row) return null;

    return {
      id: row.id,
      configPath: row.config_path,
      deviceId: row.device_id,
      deviceName: row.device_name,
      deviceIp: row.device_ip,
      repairPlan: JSON.parse(row.repair_plan),
      status: row.status as RepairRecord['status'],
      backupId: row.backup_id ?? undefined,
      executionResult: row.execution_result ?? undefined,
      errorMessage: row.error_message ?? undefined,
      approver: row.approver ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    logger.error('❌ 获取修复记录失败:', error);
    return null;
  }
}

/**
 * 获取修复记录列表
 */
export function listRepairRecords(deviceId?: string, limit = 50): RepairRecord[] {
  try {
    const rows = configRepairRecordsRepo.list({
      device_id: deviceId,
      status: undefined,
      limit,
      offset: 0,
    });

    return rows.map(row => ({
      id: row.id,
      configPath: row.config_path,
      deviceId: row.device_id,
      deviceName: row.device_name,
      deviceIp: row.device_ip,
      repairPlan: JSON.parse(row.repair_plan),
      status: row.status as RepairRecord['status'],
      backupId: row.backup_id ?? undefined,
      executionResult: row.execution_result ?? undefined,
      errorMessage: row.error_message ?? undefined,
      approver: row.approver ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    logger.error('❌ 获取修复记录列表失败:', error);
    return [];
  }
}

/**
 * 保存修复记录
 */
export function saveRepairRecord(record: RepairRecord) {
  try {
    const existing = configRepairRecordsRepo.exists(record.id);

    if (existing) {
      configRepairRecordsRepo.updateStatus(
        record.id,
        record.status,
        record.executionResult || null,
        record.errorMessage || null,
        record.updatedAt,
      );
    } else {
      configRepairRecordsRepo.create({
        id: record.id,
        config_path: record.configPath,
        device_id: record.deviceId,
        device_name: record.deviceName,
        device_ip: record.deviceIp,
        repair_plan: JSON.stringify(record.repairPlan),
        status: record.status,
        backup_id: record.backupId || null,
        approver: record.approver || null,
        approved_at: record.approvedAt || null,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      });
    }
  } catch (error) {
    logger.error('❌ 保存修复记录失败:', error);
    throw error;
  }
}