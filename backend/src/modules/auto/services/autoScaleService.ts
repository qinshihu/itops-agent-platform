/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { autoScaleRepository } from '../../../repositories';
import { dockerService } from '../../containers/services/dockerService';
import { getErrorMessage } from '../../../utils/errorHelpers';

interface ScaleRule {
  id: string;
  name: string;
  targetType: 'container' | 'vm' | 'k8s_deployment';
  targetId: string;
  targetName: string;
  metricType: 'cpu' | 'memory' | 'pod_count' | 'request_count';
  threshold: number;
  targetValue: number;
  minInstances: number;
  maxInstances: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  enabled: boolean;
  lastScaleTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface ScaleHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  targetType: string;
  targetId: string;
  action: 'scale_up' | 'scale_down';
  previousCount: number;
  currentCount: number;
  metricValue: number;
  result: 'success' | 'failed';
  reason?: string;
  timestamp: string;
}

class AutoScaleService {
  private checkInterval: NodeJS.Timeout | null = null;
  private cooldowns: Map<string, number> = new Map();

  constructor() {
    // 表结构由 migration v048 维护；本服务的运行时定时检查由 initialize() 负责。
  }

  /**
   * 启动时启动伸缩规则检查定时器
   * （原 ensureTables() 的运行时部分，schema 已下沉到 migration v048）
   */
  initialize() {
    this.startChecker();
  }

  private startChecker() {
    this.checkInterval = setInterval(() => {
      this.checkRules().catch(err => logger.error('Auto-scale check error:', err));
    }, 60000);
  }

  private async checkRules() {
    const rules = this.listRules().filter(r => r.enabled);
    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (err) {
        logger.error(`Failed to evaluate rule ${rule.name}:`, err);
      }
    }
  }

  private async evaluateRule(rule: ScaleRule) {
    const now = Date.now();
    const lastScale = this.cooldowns.get(rule.id) || 0;
    if (now - lastScale < Math.min(rule.scaleUpCooldown, rule.scaleDownCooldown) * 1000) return;

    let currentMetric = 0;
    let currentInstances = 1;

    if (rule.targetType === 'container') {
      try {
        const stats = await dockerService.getContainerStats(rule.targetId);
        if (rule.metricType === 'cpu') currentMetric = parseFloat(stats.cpuPercent as string);
        else if (rule.metricType === 'memory') currentMetric = parseFloat(stats.memory.percent as string);
        currentInstances = 1;
      } catch { return; }
    } else if (rule.targetType === 'vm') {
      currentInstances = 1;
      return;
    }

    if (currentMetric > rule.threshold && currentInstances < rule.maxInstances) {
      await this.executeScaleUp(rule, currentMetric, currentInstances);
    } else if (currentMetric < rule.targetValue * 0.5 && currentInstances > rule.minInstances) {
      await this.executeScaleDown(rule, currentMetric, currentInstances);
    }
  }

  private async executeScaleUp(rule: ScaleRule, metricValue: number, currentCount: number) {
    const newCount = Math.min(currentCount + 1, rule.maxInstances);
    this.cooldowns.set(rule.id, Date.now());

    try {
      autoScaleRepository.updateLastScaleTime(rule.id);
      this.logHistory(rule, 'scale_up', currentCount, newCount, metricValue, 'success');
      logger.info(`📈 Scale up: ${rule.name} (${currentCount} → ${newCount})`);
    } catch (err: unknown) {
      this.logHistory(rule, 'scale_up', currentCount, currentCount, metricValue, 'failed', getErrorMessage(err));
    }
  }

  private async executeScaleDown(rule: ScaleRule, metricValue: number, currentCount: number) {
    const newCount = Math.max(currentCount - 1, rule.minInstances);
    this.cooldowns.set(rule.id, Date.now());

    try {
      autoScaleRepository.updateLastScaleTime(rule.id);
      this.logHistory(rule, 'scale_down', currentCount, newCount, metricValue, 'success');
      logger.info(`📉 Scale down: ${rule.name} (${currentCount} → ${newCount})`);
    } catch (err: unknown) {
      this.logHistory(rule, 'scale_down', currentCount, currentCount, metricValue, 'failed', getErrorMessage(err));
    }
  }

  private logHistory(rule: ScaleRule, action: string, previous: number, current: number, metricValue: number, result: string, reason?: string) {
    const id = randomUUID();
    autoScaleRepository.createHistory({
      id, rule_id: rule.id, rule_name: rule.name,
      target_type: rule.targetType, target_id: rule.targetId,
      action, previous_count: previous, current_count: current,
      metric_value: metricValue, result, reason: reason || null,
    });
  }

  listRules(): ScaleRule[] {
    const rows = autoScaleRepository.listRules();
    return rows.map(r => ({
      id: r.id, name: r.name, targetType: r.target_type, targetId: r.target_id,
      targetName: r.target_name, metricType: r.metric_type,
      threshold: r.threshold, targetValue: r.target_value,
      minInstances: r.min_instances, maxInstances: r.max_instances,
      scaleUpCooldown: r.scale_up_cooldown, scaleDownCooldown: r.scale_down_cooldown,
      enabled: r.enabled === 1, lastScaleTime: r.last_scale_time,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getRule(ruleId: string): ScaleRule | null {
    const row = autoScaleRepository.getRuleById(ruleId);
    if (!row) return null;
    return {
      id: row.id, name: row.name, targetType: row.target_type, targetId: row.target_id,
      targetName: row.target_name, metricType: row.metric_type,
      threshold: row.threshold, targetValue: row.target_value,
      minInstances: row.min_instances, maxInstances: row.max_instances,
      scaleUpCooldown: row.scale_up_cooldown, scaleDownCooldown: row.scale_down_cooldown,
      enabled: row.enabled === 1, lastScaleTime: row.last_scale_time,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  createRule(data: Omit<ScaleRule, 'id' | 'createdAt' | 'updatedAt'>): ScaleRule {
    const id = randomUUID();
    autoScaleRepository.createRule({
      id, name: data.name, target_type: data.targetType, target_id: data.targetId,
      target_name: data.targetName, metric_type: data.metricType,
      threshold: data.threshold, target_value: data.targetValue,
      min_instances: data.minInstances, max_instances: data.maxInstances,
      scale_up_cooldown: data.scaleUpCooldown, scale_down_cooldown: data.scaleDownCooldown,
      enabled: data.enabled ? 1 : 0,
    });
    return this.getRule(id)!;
  }

  updateRule(ruleId: string, updates: Partial<ScaleRule>): ScaleRule {
    const existing = this.getRule(ruleId);
    if (!existing) throw new Error('规则不存在');
    const fields: Record<string, unknown> = {};
    if (updates.name !== undefined) fields.name = updates.name;
    if (updates.targetType !== undefined) fields.target_type = updates.targetType;
    if (updates.targetId !== undefined) fields.target_id = updates.targetId;
    if (updates.targetName !== undefined) fields.target_name = updates.targetName;
    if (updates.metricType !== undefined) fields.metric_type = updates.metricType;
    if (updates.threshold !== undefined) fields.threshold = updates.threshold;
    if (updates.targetValue !== undefined) fields.target_value = updates.targetValue;
    if (updates.minInstances !== undefined) fields.min_instances = updates.minInstances;
    if (updates.maxInstances !== undefined) fields.max_instances = updates.maxInstances;
    if (updates.scaleUpCooldown !== undefined) fields.scale_up_cooldown = updates.scaleUpCooldown;
    if (updates.scaleDownCooldown !== undefined) fields.scale_down_cooldown = updates.scaleDownCooldown;
    if (updates.enabled !== undefined) fields.enabled = updates.enabled ? 1 : 0;
    autoScaleRepository.updateRule(ruleId, fields);
    return this.getRule(ruleId)!;
  }

  deleteRule(ruleId: string): void {
    autoScaleRepository.deleteRule(ruleId);
  }

  getHistory(page = 1, pageSize = 20, ruleId?: string): { data: ScaleHistory[]; total: number } {
    const { rows, total } = autoScaleRepository.listHistory({ rule_id: ruleId, page, limit: pageSize });
    return {
      data: rows.map(r => ({
        id: r.id, ruleId: r.rule_id, ruleName: r.rule_name, targetType: r.target_type,
        targetId: r.target_id, action: r.action, previousCount: r.previous_count,
        currentCount: r.current_count, metricValue: r.metric_value,
        result: r.result, reason: r.reason, timestamp: r.timestamp,
      })),
      total,
    };
  }

  getSummary() {
    const activeRules = autoScaleRepository.countActiveRules();
    const todayUp = autoScaleRepository.countTodayByAction('scale_up');
    const todayDown = autoScaleRepository.countTodayByAction('scale_down');
    const totalManaged = autoScaleRepository.sumMaxInstances();
    return { activeRules, todayScaleUp: todayUp, todayScaleDown: todayDown, totalManagedInstances: totalManaged };
  }
}

export const autoScaleService = new AutoScaleService();
