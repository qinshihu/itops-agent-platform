/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * ITOps Agent Platform - AI 修复服务（核心类 + Barrel Export）
 * =============================================================================
 *
 * 将 AI 分析结果转化为可执行的修复工作流，并走审批流程
 *
 * 方法实现分散在子文件中，通过 barrel export 统一导出。
 */

import type { WorkflowParsed } from '../../../../types';

// 从子文件导入方法实现
import {
  impl_generateVerificationPrompt,
  impl_generateRollbackPrompt,
} from './analysisStep';

import {
  impl_generateRemediationWorkflow,
} from './planStep';

import {
  impl_createAndExecute,
  impl_saveWorkflow,
  impl_saveRecord,
  impl_updateRecord,
  impl_getRecord,
  impl_getByAlertId,
  impl_listRecords,
  impl_updateStatus,
} from './executionStep';

export interface AiRemediationInput {
  alertId: string;
  alertTitle: string;
  alertContent: string;
  alertSeverity: string;
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  deviceType: 'server' | 'network_device';
  diagnosis: string;
  remediationCommands: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface AiRemediationRecord {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string;
  remediation_commands: string[];
  risk_level: 'low' | 'medium' | 'high';
  status: 'pending' | 'waiting_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';
  execution_result?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

class AiRemediationService {

  /**
   * 根据 AI 分析结果创建修复工作流并执行
   * 这是断点连接的核心方法
   */
  async createAndExecute(input: AiRemediationInput): Promise<AiRemediationRecord | null> {
    return impl_createAndExecute(this, input);
  }

  /**
   * 生成修复工作流
   */
  private generateRemediationWorkflow(
    input: AiRemediationInput,
    _remediationId: string
  ): { workflow: any; workflowParsed: WorkflowParsed } {
    return impl_generateRemediationWorkflow(input, _remediationId);
  }

  /**
   * 根据修复命令生成验证 prompt
   */
  private generateVerificationPrompt(input: AiRemediationInput, commandsText: string): string {
    return impl_generateVerificationPrompt(input, commandsText);
  }

  /**
   * 根据修复命令生成回滚 prompt
   */
  private generateRollbackPrompt(input: AiRemediationInput, commandsText: string): string {
    return impl_generateRollbackPrompt(input, commandsText);
  }

  /** 保存工作流到数据库 */
  saveWorkflow(workflow: any): string {
    return impl_saveWorkflow(workflow);
  }

  /** 保存修复记录 */
  saveRecord(record: AiRemediationRecord): void {
    return impl_saveRecord(record);
  }

  /** 更新修复记录 */
  updateRecord(record: AiRemediationRecord): void {
    return impl_updateRecord(record);
  }

  /** 获取修复记录 */
  getRecord(id: string): AiRemediationRecord | null {
    return impl_getRecord(id);
  }

  /** 根据告警 ID 获取修复记录 */
  getByAlertId(alertId: string): AiRemediationRecord | null {
    return impl_getByAlertId(alertId);
  }

  /** 获取所有修复记录 */
  listRecords(limit = 50): AiRemediationRecord[] {
    return impl_listRecords(limit);
  }

  /** 更新修复状态（由工作流执行器调用） */
  updateStatus(remediationId: string, status: AiRemediationRecord['status'], result?: string): void {
    return impl_updateStatus(this, remediationId, status, result);
  }
}

export const aiRemediationService = new AiRemediationService();

// Barrel re-exports
export * from './analysisStep';
export * from './planStep';
export * from './executionStep';