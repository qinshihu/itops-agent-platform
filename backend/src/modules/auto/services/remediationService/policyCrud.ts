import { v4 as uuidv4 } from 'uuid';
import { remediationPolicyRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import type { RemediationPolicy, RemediationServiceLike } from './types';

export function createPolicy(
  service: RemediationServiceLike,
  policy: Omit<RemediationPolicy, 'id' | 'created_at' | 'updated_at'>
): RemediationPolicy {
  const id = uuidv4();

  remediationPolicyRepository.create({
    id,
    name: policy.name,
    description: policy.description || null,
    alert_source: policy.alert_source,
    alert_severity: policy.alert_severity || null,
    alert_keywords: policy.alert_keywords || null,
    alert_tags: policy.alert_tags || null,
    execution_mode: policy.execution_mode,
    workflow_id: policy.workflow_id ?? '',
    workflow_params: policy.workflow_params || null,
    max_executions_per_hour: policy.max_executions_per_hour,
    cooldown_seconds: policy.cooldown_seconds,
    require_confirmation: policy.require_confirmation ?? null,
    enable_verification: policy.enable_verification ? 1 : 0,
    verification_workflow_id: policy.verification_workflow_id || null,
    verification_params: policy.verification_params || null,
    verification_timeout_seconds: policy.verification_timeout_seconds,
    enable_rollback: policy.enable_rollback ? 1 : 0,
    rollback_workflow_id: policy.rollback_workflow_id || null,
    rollback_on_failure: policy.rollback_on_failure ? 1 : 0,
    enabled: policy.enabled ? 1 : 0,
    created_by: policy.created_by || null,
  });

  return service.getPolicy(id);
}

export function updatePolicy(
  service: RemediationServiceLike,
  id: string,
  updates: Partial<Pick<RemediationPolicy, 'name' | 'description' | 'alert_source' | 'alert_severity' | 'alert_keywords' | 'alert_tags' | 'execution_mode' | 'workflow_id' | 'workflow_params' | 'max_executions_per_hour' | 'cooldown_seconds' | 'require_confirmation' | 'enable_verification' | 'verification_workflow_id' | 'verification_params' | 'verification_timeout_seconds' | 'enable_rollback' | 'rollback_workflow_id' | 'rollback_on_failure' | 'enabled'>>
): RemediationPolicy {
  const repoFields: Record<string, unknown> = {};

  const fieldMap: Array<{ key: keyof typeof updates; repoKey: string }> = [
    { key: 'name', repoKey: 'name' },
    { key: 'description', repoKey: 'description' },
    { key: 'alert_source', repoKey: 'alert_source' },
    { key: 'alert_severity', repoKey: 'alert_severity' },
    { key: 'alert_keywords', repoKey: 'alert_keywords' },
    { key: 'alert_tags', repoKey: 'alert_tags' },
    { key: 'execution_mode', repoKey: 'execution_mode' },
    { key: 'workflow_id', repoKey: 'workflow_id' },
    { key: 'workflow_params', repoKey: 'workflow_params' },
    { key: 'max_executions_per_hour', repoKey: 'max_executions_per_hour' },
    { key: 'cooldown_seconds', repoKey: 'cooldown_seconds' },
    { key: 'require_confirmation', repoKey: 'require_confirmation' },
    { key: 'enable_verification', repoKey: 'enable_verification' },
    { key: 'verification_workflow_id', repoKey: 'verification_workflow_id' },
    { key: 'verification_params', repoKey: 'verification_params' },
    { key: 'verification_timeout_seconds', repoKey: 'verification_timeout_seconds' },
    { key: 'enable_rollback', repoKey: 'enable_rollback' },
    { key: 'rollback_workflow_id', repoKey: 'rollback_workflow_id' },
    { key: 'rollback_on_failure', repoKey: 'rollback_on_failure' },
    { key: 'enabled', repoKey: 'enabled' },
  ];

  for (const { key, repoKey } of fieldMap) {
    const value = updates[key];
    if (value !== undefined) {
      repoFields[repoKey] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    }
  }

  if (Object.keys(repoFields).length === 0) {
    throw new Error('No fields to update');
  }

  remediationPolicyRepository.update(id, repoFields);
  return service.getPolicy(id);
}

export function deletePolicy(service: RemediationServiceLike, id: string): void {
  remediationPolicyRepository.delete(id);
  logger.info(`Deleted remediation policy: ${id}`);
}

export function getPolicy(service: RemediationServiceLike, id: string): RemediationPolicy {
  const policy = remediationPolicyRepository.getById(id) as RemediationPolicy | undefined;
  if (!policy) {
    throw new Error(`Policy not found: ${id}`);
  }
  return policy;
}

export function listPolicies(
  service: RemediationServiceLike,
  filters: { enabled?: boolean; alert_source?: string; page?: number; limit?: number }
): { policies: RemediationPolicy[]; total: number } {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  const repoFilters: { enabled?: number; alert_source?: string; limit?: number; offset?: number } = { limit, offset };
  if (filters.enabled !== undefined) repoFilters.enabled = filters.enabled ? 1 : 0;
  if (filters.alert_source) repoFilters.alert_source = filters.alert_source;

  const policies = remediationPolicyRepository.list(repoFilters) as unknown as RemediationPolicy[];
  const total = remediationPolicyRepository.countAll(repoFilters);

  return { policies, total };
}

export function togglePolicy(service: RemediationServiceLike, id: string): RemediationPolicy {
  const policy = service.getPolicy(id);
  const newEnabled = policy.enabled ? 0 : 1;
  remediationPolicyRepository.setEnabled(id, newEnabled);
  return service.getPolicy(id);
}
