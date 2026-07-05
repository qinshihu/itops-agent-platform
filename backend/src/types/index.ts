// ============================================================
// 类型定义 — 统一入口
//
// - DB 行类型：从 repositories/types/ 统一 re-export（source of truth）
// - 领域类型（WorkflowNode、ExecutionContext 等）：原地定义
// ============================================================

// ── Re-exports: DB 行类型 ──

export type { Workflow, Task, ScheduledTask, WorkflowExecutionLog, WorkflowVariableTransfer } from '../repositories/types/workflow';
export type { Agent, AgentExecution, AiModel, KnowledgeEntry, RootCauseAnalysis, CopilotConversation, AiRemediation } from '../repositories/types/ai';
export type { Server, SshKey, ServerGroup, ServerGroupMapping, ServerCommandHistory, ComplianceCheck, ServiceTopology, ServerMetric } from '../repositories/types/server';
export type { User, TokenBlacklistEntry, EncryptionKey, Credential } from '../repositories/types/auth';
export type { ApprovalRequest, ChangeRecord } from '../repositories/types/change-management';
export type { Report, ReportSchedule, Script, Setting, AuditLog, ToolLink } from '../repositories/types/infra';
export type { RemediationPolicy, RemediationExecution, RemediationHistory, RemediationAudit, RemediationCooldown, AutoScaleRule, AutoScaleHistory } from '../repositories/types/auto';
export type { ConfigTemplate, ConfigTemplateHistory } from '../repositories/types/config-management';


// ── 领域类型（无对应 DB 表，保留原地定义）──

export interface ApprovalConfig {
  description: string;
  timeout: number;
  timeoutAction: 'reject' | 'wait';
  approvers: string[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  data: {
    label: string;
    agentId?: string;
    allowFailure?: boolean;
    approvalConfig?: ApprovalConfig;
    description?: string;
    avatar?: string;
    prompt?: string;
    inputKey?: string;
    outputKey?: string;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
}

export interface WorkflowParsed {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  agent_configs: Record<string, unknown>;
  is_template: number;
  created_at: string;
  updated_at: string;
}

export interface NodeResult {
  status: 'success' | 'failed' | 'pending';
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskLogEntry {
  type: 'thinking' | 'output' | 'error';
  content: string;
  nodeId?: string;
}

export interface ExecutionContext {
  variables: Record<string, unknown>;
  previousResults: Array<{ nodeId: string; status: string; output?: string; error?: string }>;
  metadata: {
    taskId: string;
    workflowName: string;
    currentNodeId?: string;
    executionDepth: number;
    startTime: string;
  };
}

export interface CommandExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface ComplianceCheckResult {
  success: boolean;
  details?: string;
}

export interface PolicyStats {
  total_triggers: number;
  success_count: number;
  failed_count: number;
  rolled_back_count: number;
  success_rate: number;
  avg_duration_ms: number;
  top_root_causes: Array<{ cause: string; count: number }>;
  daily_stats: Array<{ date: string; triggers: number; success: number; failed: number }>;
}
