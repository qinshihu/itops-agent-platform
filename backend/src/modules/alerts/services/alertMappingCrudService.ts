/**
 * Alert → Workflow 映射路由层 CRUD 抽象
 *
 * 解决问题：v3 报告 P1-5 — 路由层（modules/<m>/routes/）直访 Repository 违反 architecture.md §3.2。
 * 本 service 接收 routes 调用的入参，返回 routes 需要的响应体（含 workflow_name 联表）。
 * 业务校验（workflow 是否存在、enabled 转换、空字符串规范化）也集中在此。
 *
 * 区分：业务执行类 service 仍走 alertWorkflowMappingService.triggerFirstMatchingWorkflow()，
 *       本 service 只负责"映射配置"的 CRUD + 输入规范化。
 */
import { randomUUID } from 'crypto';
import { workflowMappingsRepo, workflowsRepo } from '../../../repositories';
import type {
  AlertWorkflowMappingCreateInput,
  AlertWorkflowMappingUpdateInput,
} from '../../../repositories/alertRepository/types';

export type AlertWorkflowMappingWithName = Awaited<ReturnType<typeof workflowMappingsRepo.list>>[number];

function normalizeNullableCondition(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

export const alertMappingCrudService = {
  /**
   * 列出所有映射（含 workflow_name 联表）
   */
  listMappings(): AlertWorkflowMappingWithName[] {
    return workflowMappingsRepo.list();
  },

  /**
   * 按 ID 获取映射；不存在返回 undefined
   */
  getMappingById(id: string): AlertWorkflowMappingWithName | undefined {
    return workflowMappingsRepo.getById(id);
  },

  /**
   * 创建映射。返回：
   *   { success: true, data: { id, ... } }            成功
   *   { success: false, error: 'Workflow not found' } workflow_id 不存在
   */
  createMapping(input: {
    alert_source?: string | null;
    alert_severity?: string | null;
    alert_title_pattern?: string | null;
    workflow_id: string;
    enabled?: number | boolean;
  }): { success: true; data: { id: string; alert_source: string | null | undefined; alert_severity: string | null | undefined; alert_title_pattern: string | null | undefined; workflow_id: string; enabled: number } } | { success: false; error: string } {
    if (!workflowsRepo.existsById(input.workflow_id)) {
      return { success: false, error: 'Workflow not found' };
    }

    const id = randomUUID();
    const enabledNum = input.enabled ? 1 : 0;
    const createInput: AlertWorkflowMappingCreateInput = {
      id,
      alert_source: normalizeNullableCondition(input.alert_source),
      alert_severity: normalizeNullableCondition(input.alert_severity),
      alert_title_pattern: normalizeNullableCondition(input.alert_title_pattern),
      workflow_id: input.workflow_id,
      enabled: enabledNum,
    };
    workflowMappingsRepo.create(createInput);

    return {
      success: true,
      data: {
        id,
        alert_source: createInput.alert_source,
        alert_severity: createInput.alert_severity,
        alert_title_pattern: createInput.alert_title_pattern,
        workflow_id: createInput.workflow_id,
        enabled: enabledNum,
      },
    };
  },

  /**
   * 更新映射。返回：
   *   { success: true }                                       成功
   *   { success: false, error: 'Mapping not found' }         id 不存在
   *   { success: false, error: 'Workflow not found' }        workflow_id 不存在
   */
  updateMapping(id: string, input: {
    alert_source?: string | null;
    alert_severity?: string | null;
    alert_title_pattern?: string | null;
    workflow_id?: string;
    enabled?: number | boolean;
  }): { success: true } | { success: false; error: string } {
    const existing = workflowMappingsRepo.getById(id);
    if (!existing) return { success: false, error: 'Alert workflow mapping not found' };

    if (input.workflow_id && !workflowsRepo.existsById(input.workflow_id)) {
      return { success: false, error: 'Workflow not found' };
    }

    const updates: AlertWorkflowMappingUpdateInput = {};
    if (input.alert_source !== undefined) updates.alert_source = normalizeNullableCondition(input.alert_source);
    if (input.alert_severity !== undefined) updates.alert_severity = normalizeNullableCondition(input.alert_severity);
    if (input.alert_title_pattern !== undefined) updates.alert_title_pattern = normalizeNullableCondition(input.alert_title_pattern);
    if (input.workflow_id) updates.workflow_id = input.workflow_id;
    if (input.enabled !== undefined) updates.enabled = input.enabled ? 1 : 0;

    if (Object.keys(updates).length > 0) {
      workflowMappingsRepo.update(id, updates);
    }
    return { success: true };
  },

  /**
   * 删除映射。返回是否成功删除（changes > 0）
   */
  deleteMapping(id: string): boolean {
    return workflowMappingsRepo.delete(id) > 0;
  },
};
