/**
 * 双层 Agent 架构类型定义
 */

// ── 语义化类型别名 ──

/** 任务上下文元数据 */
export type TaskMetadata = Record<string, unknown>;
/** 执行结果元数据 */
export type ExecutionMetadata = Record<string, unknown>;

// Agent 类型枚举
export enum AgentType {
  COORDINATOR = 'coordinator',
  SPECIALIST = 'specialist'
}

// 专业领域枚举
export enum SpecialistDomain {
  ALERT_HANDLING = 'alert_handling',
  FAULT_DIAGNOSIS = 'fault_diagnosis',
  LOG_ANALYSIS = 'log_analysis',
  SYSTEM_INSPECTION = 'system_inspection',
  CHANGE_EXECUTION = 'change_execution',
  DOCUMENT_GENERATION = 'document_generation',
  COMPLIANCE_CHECK = 'compliance_check',
  SERVER_OPERATION = 'server_operation',
  NETWORK_INSPECTION = 'network_inspection',
  DATABASE_OPERATION = 'database_operation',
  COMMAND_GENERATION = 'command_generation'
}

// 任务状态枚举
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELEGATED = 'delegated'
}

// Agent 能力描述
export interface AgentCapability {
  domain: SpecialistDomain;
  skills: string[];
  confidenceThreshold: number;
}

// 任务上下文
export interface TaskContext {
  taskId: string;
  input: string;
  userId?: string;
  timestamp: number;
  metadata?: TaskMetadata;
}

// 任务分解结果
export interface TaskDecomposition {
  mainTask: string;
  subtasks: SubTask[];
  requiredDomains: SpecialistDomain[];
  estimatedComplexity: number; // 1-10
}

// 子任务
export interface SubTask {
  id: string;
  description: string;
  assignedDomain: SpecialistDomain;
  dependencies: string[];
  priority: number;
  timeout?: number;
}

// 执行结果
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: ExecutionMetadata;
  duration: number;
  confidence?: number;
  nextActions?: string[];
}

// Agent 响应
export interface AgentResponse {
  taskId: string;
  agentId: string;
  agentName: string;
  agentType: AgentType;
  status: TaskStatus;
  result?: ExecutionResult;
  delegatedTo?: string;
  reasoning?: string;
}

// Specialist 注册信息
export interface SpecialistRegistryEntry {
  id: string;
  name: string;
  domain: SpecialistDomain;
  capabilities: AgentCapability;
  systemPrompt: string;
  temperature: number;
  enabled: boolean;
}

// Coordinator 配置
export interface CoordinatorConfig {
  maxDecompositionDepth: number;
  maxConcurrentTasks: number;
  defaultTimeout: number;
  enableFallback: boolean;
  enableAutoRetry: boolean;
  maxRetries: number;
}
