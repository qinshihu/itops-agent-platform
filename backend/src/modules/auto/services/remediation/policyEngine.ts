import db from '../../../../models/database';
import { remediationPolicyRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import type { RemediationPolicy } from '../../../../types';

export const policyEngineMixin = {
  severityRank: new Map<string, number>([
    ['disaster', 5],
    ['critical', 4],
    ['high', 3],
    ['warning', 2],
    ['medium', 2],
    ['average', 2],
    ['info', 1],
    ['low', 1],
  ]),

  severityMatches(policySeverity: string | null, alertSeverity: string | undefined): boolean {
    if (!policySeverity) return true;
    const pr = this.severityRank.get(policySeverity.toLowerCase()) ?? 0;
    const ar = this.severityRank.get((alertSeverity ?? '').toLowerCase()) ?? 0;
    return ar >= pr;
  },

  async matchAlertToPolicies(alert: { id: string; source: string; severity?: string; title?: string; content?: string; tags?: string[] }): Promise<RemediationPolicy[]> {
    const normalizedAlert = {
      ...alert,
      source: (alert.source || 'unknown').toLowerCase(),
      severity: alert.severity?.toLowerCase(),
      tags: (alert.tags || []).map(tag => tag.toLowerCase())
    };

    const specificPolicies = this._matchBySource(normalizedAlert);
    if (specificPolicies.length > 0) return specificPolicies;

    const fallbackPolicies = this._matchBySource({ ...normalizedAlert, source: '__any__' });
    return fallbackPolicies;
  },

  _matchBySource(alert: { id: string; source: string; severity?: string; title?: string; content?: string; tags?: string[] }): RemediationPolicy[] {
    const policies = db.prepare(`
      SELECT * FROM remediation_policies
      WHERE enabled = 1 AND (LOWER(alert_source) = ? OR alert_source = '*')
      ORDER BY
        CASE
          WHEN alert_source = ? THEN 0 ELSE 1
        END,
        CASE alert_severity
          WHEN 'disaster' THEN 1
          WHEN 'critical' THEN 2
          WHEN 'high' THEN 3
          WHEN 'warning' THEN 4
          WHEN 'medium' THEN 4
          WHEN 'average' THEN 4
          ELSE 5
        END
    `).all(alert.source === '__any__' ? '*' : alert.source, alert.source) as RemediationPolicy[];

    return policies.filter(policy => {
      const policySource = policy.alert_source?.toLowerCase();
      if (!policySource || policySource === '*') {
        // 通配符，不按 source 过滤
      } else if (policySource !== alert.source) {
        return false;
      }

      if (policy.alert_severity && !this.severityMatches(policy.alert_severity, alert.severity)) {
        return false;
      }

      let keywordMatched = !policy.alert_keywords;
      let tagMatched = !policy.alert_tags;

      if (policy.alert_keywords) {
        try {
          const keywords = JSON.parse(policy.alert_keywords) as string[];
          if (keywords.length === 1 && keywords[0] === '__catch_all__') {
            return true;
          }
          const alertText = `${alert.title || ''} ${alert.content || ''}`.toLowerCase();
          keywordMatched = keywords.some(kw => alertText.includes(kw.toLowerCase()));
        } catch {
          logger.warn(`Invalid alert_keywords JSON in policy ${policy.id}`);
          return false;
        }
      }

      if (policy.alert_tags) {
        try {
          const tags = JSON.parse(policy.alert_tags) as string[];
          if (tags.length === 1 && tags[0] === '__catch_all__') {
            return true;
          }
          const alertTags = alert.tags || [];
          tagMatched = tags.some(t => alertTags.includes(t.toLowerCase()));
        } catch {
          logger.warn(`Invalid alert_tags JSON in policy ${policy.id}`);
          return false;
        }
      }

      return keywordMatched || tagMatched;
    });
  },

  getCatchAllPolicies(_source: string): RemediationPolicy[] {
    return remediationPolicyRepository.findCatchAll() as RemediationPolicy[];
  },

  isInCooldown(policy: RemediationPolicy, alert: { id: string }): boolean {
    const result = db.prepare(`
      SELECT cooldown_until FROM remediation_cooldowns
      WHERE policy_id = ? AND alert_id = ?
    `).get(policy.id, alert.id) as { cooldown_until: string } | undefined;

    if (!result) return false;

    const now = new Date().toISOString();
    return now < result.cooldown_until;
  },

  isRateLimited(policy: RemediationPolicy): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM remediation_executions
      WHERE policy_id = ? AND created_at > ?
    `).get(policy.id, oneHourAgo) as { count: number };

    return result.count >= policy.max_executions_per_hour;
  },
};
