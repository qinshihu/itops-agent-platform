import { v4 as uuidv4 } from 'uuid';
import { remediationAuditRepository, alertRepository, settingsRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import type { RemediationPolicy, RemediationExecution, PolicyStats } from '../../../../types';
import type { RemediationAlert } from '../remediationService/types';

export const executionTrackerMixin = {
  async createSkippedExecution(policy: RemediationPolicy, alert: { id: string; source: string; severity?: string; title?: string; content?: string }, reason: string): Promise<RemediationExecution> {
    const id = uuidv4();
    const now = new Date().toISOString();

    remediationAuditRepository.createExecution({
      id,
      policy_id: policy.id,
      alert_id: alert.id,
      alert_snapshot: JSON.stringify(alert),
      status: 'skipped',
      status_reason: reason,
      created_at: now,
    });

    return this.getExecution(id);
  },

  getExecution(id: string): RemediationExecution {
    return remediationAuditRepository.getExecutionById(id) as unknown as RemediationExecution;
  },

  listExecutions(filters: { policy_id?: string; alert_id?: string; status?: string; page?: number; limit?: number }): { executions: RemediationExecution[]; total: number } {
    const result = remediationAuditRepository.listExecutions({
      policy_id: filters.policy_id,
      alert_id: filters.alert_id,
      status: filters.status,
      page: filters.page,
      limit: filters.limit,
    });
    return { executions: result.executions as unknown as RemediationExecution[], total: result.total };
  },

  async getPolicyStats(policyId: string, days: number): Promise<PolicyStats> {
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const stats = remediationAuditRepository.getExecutionStats(policyId, sinceDate);
    return stats as unknown as PolicyStats;
  },

  updateExecutionStatus(id: string, status: RemediationExecution['status'], reason?: string): void {
    remediationAuditRepository.updateExecutionStatus(id, status, reason);
  },

  updateExecution(id: string, updates: Partial<RemediationExecution>): void {
    remediationAuditRepository.updateExecution(id, updates as Record<string, unknown>);
  },

  resolveAlert(alertId: string): void {
    try {
      const result = alertRepository.resolve(alertId);
      if (result) {
        logger.info(`Alert ${alertId} marked as resolved by auto-remediation`);
      }
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
    }
  },

  updateCooldown(policy: RemediationPolicy, alert: RemediationAlert): void {
    if (alert.id && typeof alert.id === 'string') {
      const cooldownUntil = new Date(Date.now() + policy.cooldown_seconds * 1000).toISOString();
      remediationAuditRepository.upsertCooldown(policy.id, alert.id, cooldownUntil);
    }
  },

  recordHistory(execution: RemediationExecution, policy: RemediationPolicy, status: string, reason?: string): void {
    try {
      const alert = JSON.parse(execution.alert_snapshot || '{}');
      remediationAuditRepository.insertHistory({
        id: uuidv4(),
        policy_id: policy.id,
        alert_source: alert.source,
        alert_severity: alert.severity,
        execution_status: status,
        resolution: reason || 'Auto-remediated',
        duration_ms: execution.execution_duration_ms || null,
      });
    } catch (error) {
      logger.error('Failed to record remediation history:', error);
    }
  },

  notifySelfHeal(alertId: string | undefined, _alertTitle: string | undefined): void {
    if (!alertId) return;
    try {
      const alert = alertRepository.getById(alertId);
      if (!alert) return;

      settingsRepository.upsert(
        `self_healed:${alert.source}:${alert.title}`,
        new Date().toISOString()
      );
      logger.info(`🔄 [SelfHeal] Alert ${alertId} self-healed, noise reduction updated`);
    } catch (e) {
      logger.warn('Failed to update noise reduction after self-heal:', e);
    }
  },

  async cleanupOldExecutions(days: number): Promise<void> {
    const changes = remediationAuditRepository.cleanupOldExecutions(days);
    logger.info(`Cleaned up ${changes} old remediation executions`);
  },
};
