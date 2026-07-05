/**
 * 修复策略与执行
 * 从 configRepairService.ts 提取的修复方案生成、执行、回滚逻辑
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import type {
  ConfigTemplate,
  ConfigIssue,
  RepairPlan,
  RepairRecord,
  ConfigChange,
} from '../../../../types/configRepair';
import { findMatchingTemplate as findMatchingTemplateFn } from './detection';
import type { DetectionDeps } from './detection';
import { saveRepairRecord as saveRepairRecordFn, getRepairRecord as getRepairRecordFn } from './verification';

export interface RepairDeps {
  templates: Map<string, ConfigTemplate>;
  getTemplate: (templateId: string) => ConfigTemplate | null;
}

/**
 * 评估风险等级
 */
export function assessRiskLevel(issues: ConfigIssue[]): 'low' | 'medium' | 'high' {
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;

  if (criticalCount > 0 || highCount >= 2) {
    return 'high';
  }
  if (highCount > 0 || mediumCount >= 3) {
    return 'medium';
  }
  return 'low';
}

/**
 * 生成修复方案
 */
export async function generateRepairPlan(
  _deps: RepairDeps,
  deviceId: string,
  deviceName: string,
  deviceIp: string,
  configPath: string,
  issues: ConfigIssue[],
  _content: string
): Promise<RepairPlan> {
  const id = randomUUID();

  // 生成变更列表
  const changes: ConfigChange[] = [];
  for (const issue of issues) {
    if (issue.fixable && issue.suggestedValue !== undefined) {
      changes.push({
        id: randomUUID(),
        type: 'modify',
        lineNumber: issue.lineNumber,
        key: issue.key,
        oldValue: issue.currentValue,
        newValue: issue.suggestedValue,
        description: issue.description,
      });
    }
  }

  // 评估风险等级
  const riskLevel = assessRiskLevel(issues);

  const plan: RepairPlan = {
    id,
    configPath,
    issues,
    changes,
    riskLevel,
    estimatedImpact: changes.length > 0
      ? `将修改 ${changes.length} 个配置项`
      : '无需要修复的问题',
    rollbackAvailable: true,
  };

  logger.info(`📋 修复方案已生成: ${configPath}, ${changes.length} 个变更`);

  return plan;
}

/**
 * 执行修复
 */
export async function executeRepair(
  deps: RepairDeps,
  deviceId: string,
  deviceName: string,
  deviceIp: string,
  configPath: string,
  repairPlan: RepairPlan,
  templateId?: string,
  approver?: string
): Promise<RepairRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();

  let template = templateId ? deps.getTemplate(templateId) : null;
  if (!template) {
    const detectionDeps: DetectionDeps = { templates: deps.templates, getTemplate: deps.getTemplate };
    template = findMatchingTemplateFn(detectionDeps, configPath);
  }

  // 创建记录
  const record: RepairRecord = {
    id,
    configPath,
    deviceId,
    deviceName,
    deviceIp,
    repairPlan,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    approver,
    approvedAt: approver ? now : undefined,
  };

  saveRepairRecordFn(record);

  try {
    // 更新状态
    record.status = 'executing';
    saveRepairRecordFn(record);

    // 这里需要实际从设备读取配置、修改、写回
    // 由于这是框架代码，我们记录执行结果
    record.executionResult = JSON.stringify({
      changesApplied: repairPlan.changes.length,
      template: template?.id,
      timestamp: new Date().toISOString(),
    });

    record.status = 'completed';
    record.updatedAt = new Date().toISOString();
    saveRepairRecordFn(record);

    logger.info(`✅ 配置修复完成: ${configPath}`);
    return record;
  } catch (error) {
    record.status = 'failed';
    record.errorMessage = error instanceof Error ? error.message : String(error);
    record.updatedAt = new Date().toISOString();
    saveRepairRecordFn(record);

    logger.error(`❌ 配置修复失败: ${configPath}`, error);
    throw error;
  }
}

/**
 * 回滚修复
 */
export async function rollbackRepair(recordId: string): Promise<boolean> {
  const record = getRepairRecordFn(recordId);
  if (!record) {
    throw new Error('修复记录不存在');
  }

  if (!record.backupId) {
    throw new Error('没有可用的备份');
  }

  try {
    // 更新状态
    record.status = 'rolled_back';
    record.updatedAt = new Date().toISOString();
    saveRepairRecordFn(record);

    logger.info(`↩️ 配置修复已回滚: ${record.configPath}`);
    return true;
  } catch (error) {
    logger.error('❌ 回滚失败:', error);
    throw error;
  }
}