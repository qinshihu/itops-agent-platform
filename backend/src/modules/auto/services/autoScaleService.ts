/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { autoScaleRepository } from '../../../repositories';
import { dockerService } from '../../containers/services/dockerService';
import { vmManagementService } from '../../containers/services/vmManagement';
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
  scaleUpCooldown: number; // eslint-disable-line eqeqeq
  scaleDownCooldown: number; // eslint-disable-line eqeqeq
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

/** 记录规则最近一次"扩容/缩容"时间戳，用于 cooldown 判断 */
interface CooldownState {
  lastScaleUp: number;
  lastScaleDown: number;
}

class AutoScaleService {
  private checkInterval: NodeJS.Timeout | null = null;
  private cooldowns: Map<string, CooldownState> = new Map();

  constructor() {
    // 表结构由 migration v048 维护；本服务的运行时定时检查由 initialize() 负责。
  }

  /**
   * 启动时启动伸缩规则检查定时器
   */
  initialize() {
    this.startChecker();
  }

  /**
   * 关闭时清理定时器 + cooldown map（注册到 serviceRegistry shutdownAll）
   */
  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.cooldowns.clear();
    logger.info('[autoScaleService] Shutdown complete');
  }

  private startChecker() {
    this.checkInterval = setInterval(() => {
      this.checkRules().catch((err) => logger.error('Auto-scale check error:', err));
    }, 60000);
  }

  private async checkRules() {
    const rules = this.listRules().filter((r) => r.enabled);
    for (const rule of rules) {
      try {
        await this.evaluateRule(rule);
      } catch (err) {
        logger.error(`Failed to evaluate rule ${rule.name}:`, err);
      }
    }
  }

  /**
   * 是否在冷却期
   * @param direction 'up' / 'down'
   */
  private isInCooldown(rule: ScaleRule, direction: 'up' | 'down'): boolean {
    const state = this.cooldowns.get(rule.id) || { lastScaleUp: 0, lastScaleDown: 0 };
    const last = direction === 'up' ? state.lastScaleUp : state.lastScaleDown;
    const cooldownSec = direction === 'up' ? rule.scaleUpCooldown : rule.scaleDownCooldown;
    if (cooldownSec <= 0) return false;
    return Date.now() - last < cooldownSec * 1000;
  }

  private setCooldown(rule: ScaleRule, direction: 'up' | 'down') {
    const state = this.cooldowns.get(rule.id) || { lastScaleUp: 0, lastScaleDown: 0 };
    if (direction === 'up') state.lastScaleUp = Date.now();
    else state.lastScaleDown = Date.now();
    this.cooldowns.set(rule.id, state);
  }

  /**
   * 计算当前副本数：
   *   - container: 统计 docker 容器列表中名字前缀相同的 running 数
   *   - vm:        从 vm_platforms 视角统计平台上的 vm 数（hypervisor 优先 + SQLite 后备）
   *   - k8s_deployment: 调用 kubernetesService 获取 replicas
   */
  private async countInstances(rule: ScaleRule): Promise<number> {
    if (rule.targetType === 'container') {
      try {
        const containers = await dockerService.listContainers(true);
        const prefix = this.getContainerNamePrefix(rule);
        return containers.filter((c) => c.name.startsWith(prefix) && c.state === 'running').length;
      } catch (err) {
        logger.warn(`countInstances: docker 列表失败，回退到 1:`, err);
        return 1;
      }
    }
    if (rule.targetType === 'vm') {
      // 平台 ID 通过 targetId 形式传递（targetId 形如 `${platformId}`）
      try {
        const vms = await vmManagementService.listVMs(rule.targetId);
        return Array.isArray(vms) ? vms.length : 1;
      } catch (err) {
        logger.warn(`countInstances: VM 列表失败，回退到 1:`, err);
        return 1;
      }
    }
    if (rule.targetType === 'k8s_deployment') {
      // k8s_deployment 的 targetId 形如 `${contextId}/${namespace}/${deploymentName}`
      try {
        const [contextId, namespace, depName] = rule.targetId.split('/');
        if (!contextId || !namespace || !depName) {
          logger.warn(`k8s_deployment targetId 格式错误: ${rule.targetId}`);
          return 1;
        }
        const { kubernetesService } = await import('../../kubernetes/services/kubernetesService');
        return await kubernetesService.getDeploymentReplicas(namespace, depName, contextId);
      } catch (err) {
        logger.warn(`countInstances: k8s replicas 获取失败，回退到 1:`, err);
        return 1;
      }
    }
    return 1;
  }

  /**
   * 容器副本的前缀命名规则：{targetName}-replica- 或 targetId
   */
  private getContainerNamePrefix(rule: ScaleRule): string {
    return `${rule.targetName || rule.targetId}-replica-`;
  }

  private async evaluateRule(rule: ScaleRule) {
    let currentMetric = 0;
    const currentInstances = await this.countInstances(rule);

    // 1) 取指标
    try {
      if (rule.targetType === 'container') {
        const stats = await dockerService.getContainerStats(rule.targetId);
        if (rule.metricType === 'cpu') {
          currentMetric = Number(parseFloat(stats.cpuPercent as string));
        } else if (rule.metricType === 'memory') {
          const memPct = (stats.memory as { percent?: string | number }).percent;
          currentMetric = typeof memPct === 'string' ? parseFloat(memPct) : Number(memPct || 0);
        } else {
          // pod_count / request_count 对容器不适用
          currentMetric = 0;
        }
      } else if (rule.targetType === 'vm') {
        // VM 维度：取 hypervisor 提供的指标
        try {
          const stats = await vmManagementService.getVMStats(rule.targetId, rule.targetId);
          // 平台 ID 形如 `${platformId}/${vmId}`，纠正：仅取 vmId 调 stats
          const vmId = rule.targetId.includes('/')
            ? rule.targetId.split('/').pop()!
            : rule.targetId;
          const realStats = await vmManagementService.getVMStats(rule.targetId, vmId);
          const vmStats: any = realStats || stats;
          if (rule.metricType === 'cpu' && vmStats?.cpuUsage !== undefined) {
            currentMetric = Number(vmStats.cpuUsage);
          } else if (rule.metricType === 'memory' && vmStats?.memoryUsage !== undefined) {
            currentMetric = Number(vmStats.memoryUsage);
          } else {
            currentMetric = 0;
          }
        } catch (err) {
          logger.warn(`evaluateRule: VM 指标获取失败:`, err);
        }
      } else if (rule.targetType === 'k8s_deployment') {
        // 指标由 metricType 决定
        if (rule.metricType === 'pod_count') {
          currentMetric = currentInstances; // 副本数 = 当前 pod 数
        } else if (rule.metricType === 'cpu' || rule.metricType === 'memory') {
          // 调 metrics-server 拉真实 CPU/内存使用
          try {
            const [contextId, namespace, depName] = rule.targetId.split('/');
            if (contextId && namespace && depName) {
              const { kubernetesService } =
                await import('../../kubernetes/services/kubernetesService');
              const metrics = await kubernetesService.getDeploymentMetrics(
                namespace,
                depName,
                contextId,
              );
              if (metrics) {
                // 计算"平均每个副本"的使用率（相对 request）
                //   简化：使用率 = 总量 / (replicas × 1000m cpu) × 100 = 平均单副本使用率
                if (rule.metricType === 'cpu') {
                  const requestedTotal = currentInstances * 1000; // 假设每个副本 request 1000 millicores
                  currentMetric = requestedTotal > 0 ? (metrics.cpu / requestedTotal) * 100 : 0;
                } else {
                  const requestedTotal = currentInstances * 512; // 假设每个副本 request 512 MiB
                  currentMetric = requestedTotal > 0 ? (metrics.memory / requestedTotal) * 100 : 0;
                }
              } else {
                // metrics-server 不可用 → 跳过本次评估
                logger.debug(`Rule ${rule.name}: metrics-server 不可用，跳过 K8s 评估`);
                return;
              }
            }
          } catch (err) {
            logger.warn(`evaluateRule: K8s 指标拉取失败 (${rule.name}):`, err);
            return;
          }
        }
      }
    } catch (err) {
      logger.warn(`evaluateRule: 指标采集失败 (${rule.name}):`, err);
    }

    // 2) 决策
    if (currentMetric > rule.threshold && currentInstances < rule.maxInstances) {
      if (this.isInCooldown(rule, 'up')) {
        logger.debug(`Rule ${rule.name} 扩容冷却中，跳过`);
        return;
      }
      await this.executeScaleUp(rule, currentMetric, currentInstances);
    } else if (currentMetric < rule.targetValue * 0.5 && currentInstances > rule.minInstances) {
      if (this.isInCooldown(rule, 'down')) {
        logger.debug(`Rule ${rule.name} 缩容冷却中，跳过`);
        return;
      }
      await this.executeScaleDown(rule, currentMetric, currentInstances);
    }
  }

  private async executeScaleUp(rule: ScaleRule, metricValue: number, currentCount: number) {
    const newCount = Math.min(currentCount + 1, rule.maxInstances);
    try {
      if (rule.targetType === 'container') {
        const prefix = this.getContainerNamePrefix(rule);
        const newName = `${prefix}${Date.now()}`;
        const sourceContainer = await dockerService.getContainer(rule.targetId);
        const image = (sourceContainer.config as { Image?: string }).Image || sourceContainer.image;
        await dockerService.runContainer(image, newName, {
          restartPolicy: 'unless-stopped',
          labels: { 'managed-by': 'autoscale', 'autoscale-rule': rule.id },
        });
      } else if (rule.targetType === 'vm') {
        // targetId 形如 `${platformId}/${vmId}` 平台内具体 VM
        const [platformId, sourceVmId] = rule.targetId.includes('/')
          ? rule.targetId.split('/')
          : [rule.targetId, rule.targetId];
        if (!sourceVmId) throw new Error('vm 伸缩需要 targetId 形如 `${platformId}/${vmId}`');
        const newVmName = `${rule.targetName || 'vm'}-replica-${Date.now()}`;
        await vmManagementService.cloneVM(platformId, {
          platformId,
          vmId: sourceVmId,
          name: newVmName,
          powerOn: true,
        });
      } else if (rule.targetType === 'k8s_deployment') {
        const [contextId, namespace, depName] = rule.targetId.split('/');
        if (!contextId || !namespace || !depName) {
          throw new Error(`k8s_deployment targetId 格式错误: ${rule.targetId}`);
        }
        const { kubernetesService } = await import('../../kubernetes/services/kubernetesService');
        // 注意：scaleDeployment 的 replicas 形参是 number，但 user 写的是 newCount 已是 number
        await kubernetesService.scaleDeployment(namespace, depName, newCount, contextId);
      }

      this.setCooldown(rule, 'up');
      autoScaleRepository.updateLastScaleTime(rule.id);
      this.logHistory(rule, 'scale_up', currentCount, newCount, metricValue, 'success');
      logger.info(`📈 Scale up: ${rule.name} (${currentCount} → ${newCount})`);
    } catch (err: unknown) {
      this.setCooldown(rule, 'up');
      this.logHistory(
        rule,
        'scale_up',
        currentCount,
        currentCount,
        metricValue,
        'failed',
        getErrorMessage(err),
      );
      logger.error(`❌ Scale up failed: ${rule.name}`, err);
    }
  }

  private async executeScaleDown(rule: ScaleRule, metricValue: number, currentCount: number) {
    const newCount = Math.max(currentCount - 1, rule.minInstances);
    try {
      if (rule.targetType === 'container') {
        const containers = await dockerService.listContainers(true);
        const prefix = this.getContainerNamePrefix(rule);
        // 优先缩掉"最老的"运行中副本（FIFO）
        const candidates = containers
          .filter((c) => c.name.startsWith(prefix) && c.state === 'running')
          .sort((a, b) => a.created - b.created);
        if (candidates.length > 0) {
          await dockerService.removeContainer(candidates[0].id, true);
        }
      } else if (rule.targetType === 'vm') {
        const [platformId] = rule.targetId.includes('/')
          ? rule.targetId.split('/')
          : [rule.targetId, rule.targetId];
        const vms = await vmManagementService.listVMs(platformId);
        // 缩容：找到名字以 prefix 开头且不在 hypervisor 中作为"模板"的 vm
        const prefix = `${rule.targetName || rule.targetId}-replica-`;
        const candidates = vms
          .filter((vm) => vm.name?.startsWith(prefix))
          .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        if (candidates.length > 0) {
          await vmManagementService.powerOffVM(platformId, candidates[0].id);
          await vmManagementService.deleteVM(platformId, candidates[0].id);
        }
      } else if (rule.targetType === 'k8s_deployment') {
        const [contextId, namespace, depName] = rule.targetId.split('/');
        if (!contextId || !namespace || !depName) {
          throw new Error(`k8s_deployment targetId 格式错误: ${rule.targetId}`);
        }
        const { kubernetesService } = await import('../../kubernetes/services/kubernetesService');
        await kubernetesService.scaleDeployment(namespace, depName, newCount, contextId);
      }

      this.setCooldown(rule, 'down');
      autoScaleRepository.updateLastScaleTime(rule.id);
      this.logHistory(rule, 'scale_down', currentCount, newCount, metricValue, 'success');
      logger.info(`📉 Scale down: ${rule.name} (${currentCount} → ${newCount})`);
    } catch (err: unknown) {
      this.setCooldown(rule, 'down');
      this.logHistory(
        rule,
        'scale_down',
        currentCount,
        currentCount,
        metricValue,
        'failed',
        getErrorMessage(err),
      );
      logger.error(`❌ Scale down failed: ${rule.name}`, err);
    }
  }

  private logHistory(
    rule: ScaleRule,
    action: string,
    previous: number,
    current: number,
    metricValue: number,
    result: string,
    reason?: string,
  ) {
    const id = randomUUID();
    autoScaleRepository.createHistory({
      id,
      rule_id: rule.id,
      rule_name: rule.name,
      target_type: rule.targetType,
      target_id: rule.targetId,
      action,
      previous_count: previous,
      current_count: current,
      metric_value: metricValue,
      result,
      reason: reason || null,
    });
  }

  listRules(): ScaleRule[] {
    const rows = autoScaleRepository.listRules();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      targetType: r.target_type as ScaleRule['targetType'],
      targetId: r.target_id,
      targetName: r.target_name || '',
      metricType: r.metric_type as ScaleRule['metricType'],
      threshold: r.threshold,
      targetValue: r.target_value,
      minInstances: r.min_instances,
      maxInstances: r.max_instances,
      scaleUpCooldown: r.scale_up_cooldown,
      scaleDownCooldown: r.scale_down_cooldown,
      enabled: r.enabled === 1,
      lastScaleTime: r.last_scale_time || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getRule(ruleId: string): ScaleRule | null {
    const row = autoScaleRepository.getRuleById(ruleId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      targetType: row.target_type as ScaleRule['targetType'],
      targetId: row.target_id,
      targetName: row.target_name || '',
      metricType: row.metric_type as ScaleRule['metricType'],
      threshold: row.threshold,
      targetValue: row.target_value,
      minInstances: row.min_instances,
      maxInstances: row.max_instances,
      scaleUpCooldown: row.scale_up_cooldown,
      scaleDownCooldown: row.scale_down_cooldown,
      enabled: row.enabled === 1,
      lastScaleTime: row.last_scale_time || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  createRule(data: Omit<ScaleRule, 'id' | 'createdAt' | 'updatedAt'>): ScaleRule {
    const id = randomUUID();
    autoScaleRepository.createRule({
      id,
      name: data.name,
      target_type: data.targetType,
      target_id: data.targetId,
      target_name: data.targetName,
      metric_type: data.metricType,
      threshold: data.threshold,
      target_value: data.targetValue,
      min_instances: data.minInstances,
      max_instances: data.maxInstances,
      scale_up_cooldown: data.scaleUpCooldown,
      scale_down_cooldown: data.scaleDownCooldown,
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
    if (updates.scaleDownCooldown !== undefined) {
      fields.scale_down_cooldown = updates.scaleDownCooldown;
    }
    if (updates.enabled !== undefined) fields.enabled = updates.enabled ? 1 : 0;
    autoScaleRepository.updateRule(ruleId, fields);
    return this.getRule(ruleId)!;
  }

  deleteRule(ruleId: string): void {
    autoScaleRepository.deleteRule(ruleId);
  }

  getHistory(page = 1, pageSize = 20, ruleId?: string): { data: ScaleHistory[]; total: number } {
    const { rows, total } = autoScaleRepository.listHistory({
      rule_id: ruleId,
      page,
      limit: pageSize,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        ruleId: r.rule_id || '',
        ruleName: r.rule_name || '',
        targetType: r.target_type || '',
        targetId: r.target_id || '',
        action: r.action as ScaleHistory['action'],
        previousCount: r.previous_count || 0,
        currentCount: r.current_count || 0,
        metricValue: r.metric_value || 0,
        result: r.result as ScaleHistory['result'],
        reason: r.reason || undefined,
        timestamp: r.timestamp,
      })),
      total,
    };
  }

  getSummary() {
    const activeRules = autoScaleRepository.countActiveRules();
    const todayUp = autoScaleRepository.countTodayByAction('scale_up');
    const todayDown = autoScaleRepository.countTodayByAction('scale_down');
    const totalManaged = autoScaleRepository.sumMaxInstances();
    return {
      activeRules,
      todayScaleUp: todayUp,
      todayScaleDown: todayDown,
      totalManagedInstances: totalManaged,
    };
  }

  /**
   * 列出指定类型下可用的"伸缩目标"（v3 报告 P1-5 抽取，避免 routes 直访 Repository）
   * - container: 拉取所有运行中的容器
   * - vm: 遍历所有 hypervisor 平台下的 VM
   * - k8s_deployment: 遍历所有 K8s context 的 deployment
   */
  async listScaleTargets(
    type: 'container' | 'vm' | 'k8s_deployment',
  ): Promise<Array<{ id: string; name: string; [key: string]: unknown }>> {
    if (type === 'container') {
      if (!dockerService.isAvailable()) return [];
      try {
        const list = await dockerService.listContainers(true);
        return list.map((c) => ({ id: c.id, name: c.name }));
      } catch (err) {
        logger.debug(
          `[autoScaleService] listScaleTargets(container) error: ${getErrorMessage(err)}`,
        );
        return [];
      }
    }

    if (type === 'vm') {
      const { vmPlatformRepository } = await import('../../../repositories');
      const platforms = vmPlatformRepository.list();
      const result: Array<{ id: string; name: string; platformId: string; platformName: string }> =
        [];
      for (const p of platforms) {
        try {
          const vms = await vmManagementService.listVMs(p.id);
          for (const vm of vms) {
            result.push({
              id: `${p.id}/${vm.id}`,
              name: vm.name,
              platformId: p.id,
              platformName: p.name,
            });
          }
        } catch (err) {
          logger.debug(
            `[autoScaleService] listScaleTargets(vm) platform ${p.id} error: ${getErrorMessage(err)}`,
          );
        }
      }
      return result;
    }

    if (type === 'k8s_deployment') {
      try {
        const { kubernetesService } = await import('../../kubernetes/services/kubernetesService');
        const contexts = kubernetesService.listContexts();
        const result: Array<{
          id: string;
          name: string;
          namespace: string;
          contextId: string;
          contextName: string;
        }> = [];
        for (const ctx of contexts) {
          try {
            const deployments = await kubernetesService.listDeployments(
              ctx.namespace || 'default',
              ctx.id,
            );
            for (const dep of deployments) {
              result.push({
                id: `${ctx.id}/${dep.namespace}/${dep.name}`,
                name: dep.name,
                namespace: dep.namespace,
                contextId: ctx.id,
                contextName: ctx.name,
              });
            }
          } catch (err) {
            logger.debug(
              `[autoScaleService] listScaleTargets(k8s) context ${ctx.id} error: ${getErrorMessage(err)}`,
            );
          }
        }
        return result;
      } catch (_err) {
        // eslint-disable-line @typescript-eslint/no-unused-vars
        return [];
      }
    }

    return [];
  }
}

export const autoScaleService = new AutoScaleService();
