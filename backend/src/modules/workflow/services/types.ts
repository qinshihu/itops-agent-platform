/**
 * 增强工作流 DSL 类型定义
 */

import type { WorkflowVariables } from './workflowExpressionEvaluator';

// 工作流定义
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version?: string;
  triggers: TriggerDefinition[];
  steps: StepDefinition[];
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  environment?: Record<string, string>;
}

// 触发器定义
export interface TriggerDefinition {
  type: 'alert' | 'schedule' | 'webhook' | 'manual' | 'event';
  name: string;
  description?: string;
  config: WorkflowVariables;
  filter?: string; // CEL 表达式
}

// 步骤定义
export interface StepDefinition {
  id: string;
  name: string;
  description?: string;
  type: 'action' | 'condition' | 'parallel' | 'foreach' | 'wait' | 'task';
  provider?: string; // Provider 名称
  method?: string; // Provider 方法
  params?: WorkflowVariables;
  condition?: string; // CEL 表达式
  branches?: Record<string, StepDefinition[]>; // 条件分支
  steps?: StepDefinition[]; // 子步骤（并行、循环等）
  foreach?: string; // 循环变量 CEL 表达式
  wait?: {
    duration?: string; // 10s, 5m, 1h
    condition?: string; // CEL 表达式
  };
  timeout?: string; // 超时
  retries?: RetryConfig;
  continueOnError?: boolean;
  dependencies?: string[];
  outputs?: Record<string, string>; // 输出变量
}

// 重试配置
export interface RetryConfig {
  maxAttempts: number;
  backoff: {
    initial: string;
    max: string;
    multiplier: number;
  };
  conditions?: string[]; // 重试条件
}

// 输入定义
export interface InputDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: unknown;
  required?: boolean;
  validator?: string; // CEL 表达式
}

// 输出定义
export interface OutputDefinition {
  name: string;
  value: string; // CEL 表达式
  description?: string;
}

// 工作流执行状态
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  trigger: string;
  startedAt: number;
  endedAt?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  inputs: WorkflowVariables;
  outputs?: WorkflowVariables;
  steps: StepExecution[];
  error?: string;
}

// 步骤执行状态
export interface StepExecution {
  id: string;
  stepId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: number;
  endedAt?: number;
  output?: unknown;
  error?: string;
  duration?: number;
  attempt?: number;
}

// 工作流上下文
export interface WorkflowContext {
  execution: WorkflowExecution;
  inputs: WorkflowVariables;
  outputs: WorkflowVariables;
  steps: Record<string, StepExecution>;
  environment: Record<string, string>;
  secrets: Record<string, string>;
  vars: WorkflowVariables;
}
