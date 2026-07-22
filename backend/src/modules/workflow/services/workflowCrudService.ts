/**
 * Workflow 路由层 CRUD 抽象（v3 报告 P1-5 迁移）
 *
 * 解决问题：路由层（modules/<m>/routes/）直访 Repository 违反 architecture.md §3.2。
 * 本 service 把 JSON 字段解析、ID 生成、CRUD 调用、错误码转换集中到一处。
 *
 * 区分：
 *   - workflowCrudService（本文件）：CRUD + JSON 字段序列化/反序列化
 *   - WorkflowEngine / workflowExecutor：执行引擎
 *   - workflowProviderRegistry：AI Provider 抽象
 */
import { randomUUID } from 'crypto';
import { workflowRepository } from '../../../repositories';
import type { WorkflowParsed } from '../../../types';

type WorkflowWithJsonFields = {
  id: string;
  name: string;
  description?: string | null;
  nodes: unknown;
  edges: unknown;
  agent_configs?: unknown;
  is_template?: number;
  created_at?: string;
  updated_at?: string;
};

function parseJsonFields<T extends { nodes?: unknown; edges?: unknown; agent_configs?: unknown }>(w: T): T {
  const result = { ...w };
  if (typeof w.nodes === 'string') (result as Record<string, unknown>).nodes = JSON.parse(w.nodes);
  if (typeof w.edges === 'string') (result as Record<string, unknown>).edges = JSON.parse(w.edges);
  if (typeof w.agent_configs === 'string') (result as Record<string, unknown>).agent_configs = JSON.parse(w.agent_configs);
  return result;
}

export const workflowCrudService = {
  // ── 列表 / 详情 ──

  /**
   * 列出所有工作流（自动解析 JSON 字段）
   */
  listWorkflows(): WorkflowWithJsonFields[] {
    return (workflowRepository.workflows.list() as unknown as WorkflowWithJsonFields[]).map(parseJsonFields);
  },

  /**
   * 按 ID 获取工作流（自动解析 JSON 字段）；不存在返回 undefined
   */
  getWorkflowById(id: string): WorkflowWithJsonFields | undefined {
    const w = workflowRepository.workflows.getById(id);
    if (!w) return undefined;
    return parseJsonFields(w as unknown as WorkflowWithJsonFields);
  },

  // ── 创建 ──

  /**
   * 创建工作流，返回带解析后字段的对象
   */
  createWorkflow(input: {
    name: string;
    description?: string | null;
    nodes?: unknown;
    edges?: unknown;
    agent_configs?: unknown;
    is_template?: number | boolean;
  }): WorkflowWithJsonFields | undefined {
    const id = randomUUID();
    workflowRepository.workflows.create({
      id,
      name: input.name,
      description: input.description ?? null,
      nodes: JSON.stringify(input.nodes || []),
      edges: JSON.stringify(input.edges || []),
      agent_configs: JSON.stringify(input.agent_configs || {}),
      is_template: input.is_template ? 1 : 0,
    });
    return this.getWorkflowById(id);
  },

  // ── 更新 ──

  /**
   * 更新工作流，返回更新后对象
   */
  updateWorkflow(id: string, input: {
    name?: string;
    description?: string | null;
    nodes?: unknown;
    edges?: unknown;
    agent_configs?: unknown;
    is_template?: number | boolean;
  }): WorkflowWithJsonFields | undefined {
    workflowRepository.workflows.update(id, {
      name: input.name,
      description: input.description,
      nodes: JSON.stringify(input.nodes || []),
      edges: JSON.stringify(input.edges || []),
      agent_configs: JSON.stringify(input.agent_configs || {}),
      is_template: input.is_template ? 1 : 0,
    });
    return this.getWorkflowById(id);
  },

  // ── 删除 ──

  /**
   * 删除工作流；返回删除前是否存在的对象
   */
  deleteWorkflow(id: string): { deleted: boolean; existed: boolean } {
    const existed = !!workflowRepository.workflows.getById(id);
    if (existed) workflowRepository.workflows.delete(id);
    return { deleted: existed, existed };
  },

  // ── 导入 / 导出 ──

  /**
   * 导入工作流（从 WorkflowParsed 数据）
   */
  importWorkflow(workflowData: WorkflowParsed): WorkflowWithJsonFields | undefined {
    const id = randomUUID();
    workflowRepository.workflows.create({
      id,
      name: workflowData.name,
      description: workflowData.description ?? null,
      nodes: JSON.stringify(workflowData.nodes || []),
      edges: JSON.stringify(workflowData.edges || []),
      agent_configs: JSON.stringify(workflowData.agent_configs || {}),
      is_template: 0,
    });
    return this.getWorkflowById(id);
  },

  /**
   * 导出工作流为 WorkflowParsed（用于复制/分享）
   */
  exportWorkflow(id: string): WorkflowParsed | undefined {
    const w = workflowRepository.workflows.getById(id);
    if (!w) return undefined;
    return {
      id: '',
      name: w.name,
      description: w.description ?? undefined,
      nodes: JSON.parse((w.nodes as string) || '[]'),
      edges: JSON.parse((w.edges as string) || '[]'),
      agent_configs: JSON.parse((w.agent_configs as string) || '{}'),
      is_template: 0,
      created_at: '',
      updated_at: '',
    };
  },
};
