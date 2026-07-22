import type { Edge, Node } from '@xyflow/react';

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  model: string;
  temperature: number;
  enabled: number;
  system_prompt?: string;
  description?: string;
}

export interface WorkflowData {
  id?: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  is_template?: number;
}

export interface AgentNodeData {
  label?: string;
  avatar?: string;
  description?: string;
  inputKey?: string;
  outputKey?: string;
  prompt?: string;
  agentId?: string;
}

export interface ApprovalNodeData {
  label?: string;
  description?: string;
  approvalConfig?: {
    description?: string;
    timeout?: number;
    timeoutAction?: string;
    approvers?: string[];
  };
}

export interface ProviderNodeData {
  label?: string;
  description?: string;
  providerId?: string;
  providerName?: string;
  providerType?: string;
  configSchema?: {
    properties?: Record<string, { title?: string; description?: string; type?: string; enum?: string[]; default?: string }>;
  } | null;
  method?: string;
  config?: Record<string, unknown>;
}

export interface GenericNodeData {
  label?: string;
  [key: string]: unknown;
}

// ── Enhanced Node Types（5 类 AARS 增强节点）──

export type VerificationGate =
  | 'command_success'
  | 'service_health'
  | 'metric_recovery'
  | 'baseline_comparison'
  | 'impact_assessment';

export type DecisionAction = 'auto_execute' | 'request_approval' | 'escalate_to_human' | 'block';

export interface VerificationNodeData {
  label?: string;
  description?: string;
  /** 验证门禁列表 */
  gates?: VerificationGate[];
  /** SSH 目标服务器ID（可留空，使用上下文） */
  serverId?: string;
  /** 自定义各阶段参数 */
  stageOverrides?: Record<VerificationGate, Partial<{
    required: boolean;
    maxRetries: number;
    retryIntervalSec: number;
    timeoutSec: number;
  }>>;
  /** 验证超时(ms)，默认 300000 */
  timeout?: number;
  allowFailure?: boolean;
}

export interface RiskAssessNodeData {
  label?: string;
  description?: string;
  /** 风险评估输入来源节点ID */
  planSourceNodeId?: string;
  /** 告警严重程度（可从变量注入） */
  alertSeverity?: string;
  /** 告警标题（可从变量注入） */
  alertTitle?: string;
  /** 自定义阈值（默认 0.35/0.65/0.85） */
  thresholds?: {
    auto?: number;
    approve?: number;
    manual?: number;
  };
  allowFailure?: boolean;
}

export interface DecisionRuleConfig {
  /** 条件表达式，支持 risk_score / risk_level */
  condition: string;
  /** 匹配时的动作 */
  action: DecisionAction;
  /** 动作说明 */
  description?: string;
}

export interface DecisionNodeData {
  label?: string;
  description?: string;
  /** 决策规则列表（从上到下匹配，首个命中生效） */
  rules: DecisionRuleConfig[];
  /** 风险评估来源节点ID */
  riskSourceNodeId?: string;
  /** 默认动作（无规则命中时） */
  defaultAction?: DecisionAction;
  allowFailure?: boolean;
}

export interface KnowledgeNodeData {
  label?: string;
  description?: string;
  /** 知识类别，默认"故障处理" */
  category?: string;
  /** 知识标题模板 */
  titleTemplate?: string;
  /** 是否去重（默认 true） */
  deduplicate?: boolean;
  /** 去重相似度阈值 (0~1, 默认 0.7) */
  similarityThreshold?: number;
  allowFailure?: boolean;
}

export interface RollbackNodeData {
  label?: string;
  description?: string;
  /** 回滚命令来源节点ID */
  commandSourceNodeId?: string;
  /** 服务器ID */
  serverId?: string;
  /** 每条命令的超时(ms)，默认 30000 */
  commandTimeout?: number;
  /** 回滚后是否重新验证 */
  verifyAfterRollback?: boolean;
  allowFailure?: boolean;
}

export type NodeData =
  | AgentNodeData
  | ApprovalNodeData
  | ProviderNodeData
  | VerificationNodeData
  | RiskAssessNodeData
  | DecisionNodeData
  | KnowledgeNodeData
  | RollbackNodeData
  | GenericNodeData;

export interface Provider {
  id: string;
  name: string;
  type: string;
  configSchema: Record<string, unknown> | null;
}