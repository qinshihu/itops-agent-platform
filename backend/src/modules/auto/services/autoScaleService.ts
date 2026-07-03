import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import db from '../../../models/database';
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
        if (rule.metricType === 'cpu') currentMetric = parseFloat(stats.cpuPercent);
        else if (rule.metricType === 'memory') currentMetric = parseFloat(stats.memory.percent);
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
      db.prepare(`UPDATE auto_scale_rules SET last_scale_time=datetime('now','localtime') WHERE id=?`).run(rule.id);
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
      db.prepare(`UPDATE auto_scale_rules SET last_scale_time=datetime('now','localtime') WHERE id=?`).run(rule.id);
      this.logHistory(rule, 'scale_down', currentCount, newCount, metricValue, 'success');
      logger.info(`📉 Scale down: ${rule.name} (${currentCount} → ${newCount})`);
    } catch (err: unknown) {
      this.logHistory(rule, 'scale_down', currentCount, currentCount, metricValue, 'failed', getErrorMessage(err));
    }
  }

  private logHistory(rule: ScaleRule, action: string, previous: number, current: number, metricValue: number, result: string, reason?: string) {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO auto_scale_history (id, rule_id, rule_name, target_type, target_id, action, previous_count, current_count, metric_value, result, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, rule.id, rule.name, rule.targetType, rule.targetId, action, previous, current, metricValue, result, reason || null);
  }

  listRules(): ScaleRule[] {
    const rows = db.prepare('SELECT * FROM auto_scale_rules ORDER BY name').all() as any[];
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
    const row = db.prepare('SELECT * FROM auto_scale_rules WHERE id = ?').get(ruleId) as any;
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
    db.prepare(`
      INSERT INTO auto_scale_rules (id, name, target_type, target_id, target_name, metric_type, threshold, target_value, min_instances, max_instances, scale_up_cooldown, scale_down_cooldown, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.targetType, data.targetId, data.targetName, data.metricType, data.threshold, data.targetValue, data.minInstances, data.maxInstances, data.scaleUpCooldown, data.scaleDownCooldown, data.enabled ? 1 : 0);
    return this.getRule(id)!;
  }

  updateRule(ruleId: string, updates: Partial<ScaleRule>): ScaleRule {
    const existing = this.getRule(ruleId);
    if (!existing) throw new Error('规则不存在');
    db.prepare(`
      UPDATE auto_scale_rules SET name=?, target_type=?, target_id=?, target_name=?, metric_type=?, threshold=?, target_value=?, min_instances=?, max_instances=?, scale_up_cooldown=?, scale_down_cooldown=?, enabled=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(updates.name || existing.name, updates.targetType || existing.targetType, updates.targetId || existing.targetId, updates.targetName || existing.targetName, updates.metricType || existing.metricType, updates.threshold !== undefined ? updates.threshold : existing.threshold, updates.targetValue !== undefined ? updates.targetValue : existing.targetValue, updates.minInstances || existing.minInstances, updates.maxInstances || existing.maxInstances, updates.scaleUpCooldown || existing.scaleUpCooldown, updates.scaleDownCooldown || existing.scaleDownCooldown, updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : (existing.enabled ? 1 : 0), ruleId);
    return this.getRule(ruleId)!;
  }

  deleteRule(ruleId: string): void {
    db.prepare('DELETE FROM auto_scale_rules WHERE id = ?').run(ruleId);
  }

  getHistory(page = 1, pageSize = 20, ruleId?: string): { data: ScaleHistory[]; total: number } {
    let where = '';
    const params: any[] = [];
    if (ruleId) { where = 'WHERE rule_id = ?'; params.push(ruleId); }
    const total = (db.prepare(`SELECT COUNT(*) as count FROM auto_scale_history ${where}`).get(...params) as any)?.count || 0;
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT * FROM auto_scale_history ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset) as any[];
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
    const activeRules = (db.prepare("SELECT COUNT(*) as count FROM auto_scale_rules WHERE enabled = 1").get() as any)?.count || 0;
    const todayUp = (db.prepare("SELECT COUNT(*) as count FROM auto_scale_history WHERE action='scale_up' AND date(timestamp)=date('now','localtime')").get() as any)?.count || 0;
    const todayDown = (db.prepare("SELECT COUNT(*) as count FROM auto_scale_history WHERE action='scale_down' AND date(timestamp)=date('now','localtime')").get() as any)?.count || 0;
    const totalManaged = (db.prepare("SELECT SUM(max_instances) as sum FROM auto_scale_rules WHERE enabled = 1").get() as any)?.sum || 0;
    return { activeRules, todayScaleUp: todayUp, todayScaleDown: todayDown, totalManagedInstances: totalManaged };
  }
}

export const autoScaleService = new AutoScaleService();
