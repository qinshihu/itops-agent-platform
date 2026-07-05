import type {
  RemediationPolicy,
  RemediationExecution,
  WorkflowNode,
  WorkflowEdge,
  WorkflowParsed,
  PolicyStats
} from '../../../../types';

export type {
  RemediationPolicy,
  RemediationExecution,
  WorkflowNode,
  WorkflowEdge,
  WorkflowParsed,
  PolicyStats
};

/**
 * Alert shape accepted by remediation trigger / matching methods.
 * Mirrors the inline alert type used throughout the original service.
 */
export interface RemediationAlert {
  id: string;
  source: string;
  severity?: string;
  title?: string;
  content?: string;
  tags?: string[];
  device_ip?: string;
  host?: string;
  service?: string;
}

/**
 * Contract that the standalone extraction functions rely on.
 * Includes mixin-provided methods for type-safe access.
 */
export interface RemediationServiceLike {
  getPolicy(id: string): RemediationPolicy;
  verifyResult(executionId: string): Promise<{ success: boolean; result?: unknown; error?: string }>;
  rollbackExecution(executionId: string): Promise<void>;
  // Mixin-provided methods
  isInCooldown(policy: RemediationPolicy, alert: RemediationAlert): boolean;
  isRateLimited(policy: RemediationPolicy): boolean;
  createSkippedExecution(policy: RemediationPolicy, alert: RemediationAlert, reason: string): RemediationExecution;
  getExecution(id: string): RemediationExecution;
  updateExecutionStatus(executionId: string, status: string, reason?: string): void;
  updateExecution(executionId: string, updates: Partial<RemediationExecution>): void;
  resolveAlert(alertId: string): void;
  notifySelfHeal(alertId: string, title?: string): void;
  updateCooldown(policy: RemediationPolicy, alert: RemediationAlert): void;
  recordHistory(execution: RemediationExecution, policy: RemediationPolicy, status: string, error?: string): void;
}
