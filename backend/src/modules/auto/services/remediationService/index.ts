import { logger } from '../../../../utils/logger';
import { policyEngineMixin } from '../remediation/policyEngine';
import { executionTrackerMixin } from '../remediation/executionTracker';
import { remediationActionsMixin } from '../remediation/remediationActions';
import type { RemediationPolicy, RemediationExecution, PolicyStats, RemediationAlert, RemediationServiceLike } from './types';

// Barrel re-exports so consumers can import types from the service entry point
export type {
  RemediationPolicy,
  RemediationExecution,
  WorkflowNode,
  WorkflowEdge,
  WorkflowParsed,
  PolicyStats,
  RemediationAlert,
  RemediationServiceLike
} from './types';

import {
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicy,
  listPolicies,
  togglePolicy
} from './policyCrud';
import {
  triggerRemediation,
  executeWorkflowAsync,
  executeWorkflow,
  resolveParams,
  requestApproval,
  sendSuggestion
} from './executionOrchestration';
import {
  verifyResult,
  rollbackExecution,
  approveExecution,
  retryExecution
} from './verificationRollback';

class RemediationService {
  private initialized = false;

  constructor() {
    Object.assign(this, policyEngineMixin);
    Object.assign(this, executionTrackerMixin);
    Object.assign(this, remediationActionsMixin);
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('Auto-remediation engine initialized');
  }

  // ---- Methods provided by mixins (Object.assign in constructor) ----
  declare matchAlertToPolicies: (alert: RemediationAlert) => Promise<RemediationPolicy[]>;
  declare listExecutions: (filters: { policy_id?: string; alert_id?: string; status?: string; page?: number; limit?: number }) => { executions: RemediationExecution[]; total: number };
  declare getExecution: (id: string) => RemediationExecution;
  declare getPolicyStats: (policyId: string, days: number) => Promise<PolicyStats>;
  declare listAudits: (filters: { status?: string; risk_level?: string; page?: number; limit?: number }) => { audits: Array<Record<string, unknown>>; total: number };
  declare createAudit: (input: { rca_id: string; policy_id?: string; server_id: string; risk_level: string; recommendations?: string }) => Record<string, unknown>;
  declare approveAudit: (id: string, userId: string, action?: string, comment?: string) => Record<string, unknown>;
  declare executeAudit: (id: string) => Promise<Record<string, unknown>>;
  declare verifyAudit: (id: string) => Promise<Record<string, unknown>>;
  declare getAudit: (id: string) => Record<string, unknown>;
  declare rollbackAudit: (id: string) => Promise<Record<string, unknown>>;

  // ---- Policy CRUD ----
  createPolicy(policy: Omit<RemediationPolicy, 'id' | 'created_at' | 'updated_at'>): RemediationPolicy {
    return createPolicy(this as unknown as RemediationServiceLike, policy);
  }

  updatePolicy(id: string, updates: Partial<Pick<RemediationPolicy, 'name' | 'description' | 'alert_source' | 'alert_severity' | 'alert_keywords' | 'alert_tags' | 'execution_mode' | 'workflow_id' | 'workflow_params' | 'max_executions_per_hour' | 'cooldown_seconds' | 'require_confirmation' | 'enable_verification' | 'verification_workflow_id' | 'verification_params' | 'verification_timeout_seconds' | 'enable_rollback' | 'rollback_workflow_id' | 'rollback_on_failure' | 'enabled'>>): RemediationPolicy {
    return updatePolicy(this as unknown as RemediationServiceLike, id, updates);
  }

  deletePolicy(id: string): void {
    return deletePolicy(this as unknown as RemediationServiceLike, id);
  }

  getPolicy(id: string): RemediationPolicy {
    return getPolicy(this as unknown as RemediationServiceLike, id);
  }

  listPolicies(filters: { enabled?: boolean; alert_source?: string; page?: number; limit?: number }): { policies: RemediationPolicy[]; total: number } {
    return listPolicies(this as unknown as RemediationServiceLike, filters);
  }

  togglePolicy(id: string): RemediationPolicy {
    return togglePolicy(this as unknown as RemediationServiceLike, id);
  }

  // ---- Execution Orchestration ----
  async triggerRemediation(policy: RemediationPolicy, alert: RemediationAlert): Promise<RemediationExecution> {
    return triggerRemediation(this as unknown as RemediationServiceLike, policy, alert);
  }

  private async executeWorkflowAsync(executionId: string): Promise<void> {
    return executeWorkflowAsync(this as unknown as RemediationServiceLike, executionId);
  }

  async executeWorkflow(executionId: string): Promise<void> {
    return executeWorkflow(this as unknown as RemediationServiceLike, executionId);
  }

  private resolveParams(paramsJson: string | undefined, alert: RemediationAlert): Record<string, unknown> {
    return resolveParams(paramsJson, alert);
  }

  private async requestApproval(execution: RemediationExecution): Promise<void> {
    return requestApproval(this as unknown as RemediationServiceLike, execution);
  }

  private async sendSuggestion(execution: RemediationExecution): Promise<void> {
    return sendSuggestion(this as unknown as RemediationServiceLike, execution);
  }

  // ---- Verification / Rollback / Approval / Retry ----
  async verifyResult(executionId: string): Promise<{ success: boolean; result?: unknown; error?: string }> {
    return verifyResult(this as unknown as RemediationServiceLike, executionId);
  }

  async rollbackExecution(executionId: string): Promise<void> {
    return rollbackExecution(this as unknown as RemediationServiceLike, executionId);
  }

  async approveExecution(executionId: string, action: 'approve' | 'reject', userId: string, comment?: string): Promise<void> {
    return approveExecution(this as unknown as RemediationServiceLike, executionId, action, userId, comment);
  }

  async retryExecution(executionId: string): Promise<void> {
    return retryExecution(this as unknown as RemediationServiceLike, executionId);
  }
}

export const remediationService = new RemediationService();
