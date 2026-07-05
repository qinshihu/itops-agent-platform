/**
 * =============================================================================
 * AARS v2 — 渐进式升级引擎
 *
 * 告警生命周期状态机（可配置的超时/阶段）：
 *   created → auto_handled → check_1min → check_3min → notify_oncall → notify_manager → emergency
 *
 * 每个阶段对应一个超时时间，超时后自动进入下一阶段
 * 升级规则按严重等级配置
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import { smartNotifier } from '../notification/smartNotifier';
import type { DeviceRuntimeProfile } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

// ── 升级阶段定义 ──

export type EscalationStage =
  | 'auto_handled'
  | 'check_1min'
  | 'check_3min'
  | 'notify_oncall'
  | 'notify_manager'
  | 'emergency'
  | 'resolved'
  | 'failed';

interface EscalationRule {
  severity: string;
  stages: Array<{
    stage: EscalationStage;
    timeoutSec: number;    // 此阶段超时后自动升级
    notifyChannels: string[];
    shouldEscalate: boolean;
  }>;
}

interface EscalationState {
  alertId: string;
  alertTitle: string;
  alertSeverity: string;
  device: DeviceRuntimeProfile | null;
  currentStage: EscalationStage;
  stageEnteredAt: number;
  processedAt: number;       // AARS 开始处理时间
  resolvedAt?: number;
  timerId?: NodeJS.Timeout;
}

// ── 升级规则配置 ──

const ESCALATION_RULES: EscalationRule[] = [
  {
    severity: 'critical',
    stages: [
      { stage: 'auto_handled', timeoutSec: 60,  notifyChannels: [],                  shouldEscalate: false },
      { stage: 'check_1min',   timeoutSec: 60,  notifyChannels: ['wecom', 'dingtalk'], shouldEscalate: false },
      { stage: 'check_3min',   timeoutSec: 120, notifyChannels: ['wecom'],           shouldEscalate: false },
      { stage: 'notify_oncall', timeoutSec: 180, notifyChannels: ['wecom', 'dingtalk', 'email'], shouldEscalate: true },
      { stage: 'notify_manager', timeoutSec: 300, notifyChannels: ['wecom', 'dingtalk', 'email'], shouldEscalate: true },
      { stage: 'emergency',    timeoutSec: 600,  notifyChannels: ['wecom', 'dingtalk', 'email'], shouldEscalate: true },
    ],
  },
  {
    severity: 'high',
    stages: [
      { stage: 'auto_handled', timeoutSec: 120,  notifyChannels: [],                  shouldEscalate: false },
      { stage: 'check_3min',   timeoutSec: 180,  notifyChannels: ['wecom'],           shouldEscalate: false },
      { stage: 'notify_oncall', timeoutSec: 300,  notifyChannels: ['wecom', 'dingtalk'], shouldEscalate: true },
      { stage: 'notify_manager', timeoutSec: 600, notifyChannels: ['wecom', 'dingtalk', 'email'], shouldEscalate: true },
      { stage: 'emergency',    timeoutSec: 1200, notifyChannels: ['wecom', 'dingtalk', 'email'], shouldEscalate: true },
    ],
  },
  {
    severity: 'medium',
    stages: [
      { stage: 'auto_handled', timeoutSec: 300, notifyChannels: [], shouldEscalate: false },
      { stage: 'notify_oncall', timeoutSec: 600, notifyChannels: ['wecom'], shouldEscalate: true },
    ],
  },
  {
    severity: 'warning',
    stages: [
      { stage: 'auto_handled', timeoutSec: 600, notifyChannels: [], shouldEscalate: false },
      { stage: 'notify_oncall', timeoutSec: 900, notifyChannels: ['wecom'], shouldEscalate: false },
    ],
  },
];

class EscalationEngine {
  private states = new Map<string, EscalationState>();
  private running = false;
  private checkTimer: NodeJS.Timeout | null = null;

  /**
   * 启动升级引擎的后台检查
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('🚀 [EscalationEngine] 渐进式升级引擎已启动');
    this.checkTimer = setInterval(() => this.checkTimedOut(), 15_000); // 每 15 秒检查一次
  }

  /**
   * 停止
   */
  stop(): void {
    this.running = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    // 清空所有 timer
    for (const state of this.states.values()) {
      if (state.timerId) clearTimeout(state.timerId);
    }
    this.states.clear();
    logger.info('⏹ [EscalationEngine] 升级引擎已停止');
  }

  /**
   * 开始追踪某个告警的升级状态
   */
  track(alertId: string, alertTitle: string, alertSeverity: string, device: DeviceRuntimeProfile | null): void {
    if (this.states.has(alertId)) return; // 已在追踪

    const state: EscalationState = {
      alertId,
      alertTitle,
      alertSeverity,
      device,
      currentStage: 'auto_handled',
      stageEnteredAt: Date.now(),
      processedAt: Date.now(),
    };

    this.states.set(alertId, state);
    logger.info(`[EscalationEngine] 开始追踪告警 ${alertId} (${alertSeverity})`);
  }

  /**
   * 标记告警已解决 —— 停止升级追踪
   */
  resolve(alertId: string): void {
    const state = this.states.get(alertId);
    if (!state) return;

    state.currentStage = 'resolved';
    state.resolvedAt = Date.now();
    if (state.timerId) clearTimeout(state.timerId);

    // 延迟清除状态（保留记录供后续查询）
    setTimeout(() => this.states.delete(alertId), 300_000);
  }

  /**
   * 标记告警处理失败
   */
  fail(alertId: string): void {
    const state = this.states.get(alertId);
    if (!state) return;

    state.currentStage = 'failed';
    if (state.timerId) clearTimeout(state.timerId);
  }

  /**
   * 处理完成时（auto_executed 后）更新阶段
   */
  onProcessed(alertId: string, success: boolean): void {
    const state = this.states.get(alertId);
    if (!state) return;

    if (success) {
      this.resolve(alertId);
    } else {
      state.currentStage = 'check_1min';
      state.stageEnteredAt = Date.now();
      logger.info(`[EscalationEngine] 告警 ${alertId} 自动处理失败，进入 check_1min 阶段`);
    }
  }

  /**
   * 后台定时检查每个追踪中的告警
   */
  private checkTimedOut(): void {
    const now = Date.now();

    for (const [, state] of this.states) {
      if (state.currentStage === 'resolved' || state.currentStage === 'failed') continue;

      const rule = this.getRule(state.alertSeverity);
      if (!rule) continue;

      const stageIdx = rule.stages.findIndex(s => s.stage === state.currentStage);
      if (stageIdx < 0) continue;

      const currentStageConfig = rule.stages[stageIdx];
      const elapsed = (now - state.stageEnteredAt) / 1000;

      if (elapsed >= currentStageConfig.timeoutSec) {
        this.escalate(state, rule, stageIdx);
      }
    }
  }

  /**
   * 自动升级到下一阶段
   */
  private async escalate(state: EscalationState, rule: EscalationRule, currentStageIdx: number): Promise<void> {
    const nextStageIdx = currentStageIdx + 1;
    if (nextStageIdx >= rule.stages.length) {
      logger.warn(`[EscalationEngine] 告警 ${state.alertId} 已达最后阶段，不再升级`);
      return;
    }

    const nextStage = rule.stages[nextStageIdx];
    state.currentStage = nextStage.stage;
    state.stageEnteredAt = Date.now();

    logger.info(
      `[EscalationEngine] 告警 ${state.alertId} 升级至 ${nextStage.stage} ` +
      `(已过 ${(Date.now() - state.processedAt) / 1000}s)`
    );

    // 通知
    if (nextStage.notifyChannels.length > 0 && state.device) {
      const elapsed = Math.round((Date.now() - state.processedAt) / 1000);
      const minuteStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}分${elapsed % 60}秒` : `${elapsed}秒`;

      try {
        await smartNotifier.notify({
          alertId: state.alertId,
          alertTitle: state.alertTitle,
          alertSeverity: state.alertSeverity,
          device: state.device,
          reason: 'escalated',
          summary: `升级至 ${this.getStageLabel(nextStage.stage)}（已处理 ${minuteStr}，告警仍未恢复）`,
          detail: `告警自 ${new Date(state.processedAt).toLocaleString('zh-CN')} 开始处理，` +
                  `当前阶段: ${this.getStageLabel(nextStage.stage)}\n` +
                  `请及时人工介入。`,
        });
      } catch (err: unknown) {
        logger.warn(`[EscalationEngine] 升级通知发送失败: ${getErrorMessage(err)}`);
      }
    }
  }

  // ══════════════════ 工具方法 ══════════════════

  private getRule(severity: string): EscalationRule | undefined {
    return ESCALATION_RULES.find(r => r.severity === severity);
  }

  private getStageLabel(stage: EscalationStage): string {
    const map: Record<EscalationStage, string> = {
      auto_handled: '自动处理中',
      check_1min: '观察期(1分钟)',
      check_3min: '观察期(3分钟)',
      notify_oncall: '通知值班',
      notify_manager: '通知负责人',
      emergency: '紧急升级',
      resolved: '已解决',
      failed: '处理失败',
    };
    return map[stage] || stage;
  }

  /**
   * 获取当前追踪状态（对外接口）
   */
  getState(alertId: string): EscalationState | undefined {
    return this.states.get(alertId);
  }

  /**
   * 获取所有活跃的升级追踪
   */
  getActiveStates(): Array<{ alertId: string; stage: string; elapsed: number }> {
    const now = Date.now();
    return Array.from(this.states.values())
      .filter(s => s.currentStage !== 'resolved' && s.currentStage !== 'failed')
      .map(s => ({
        alertId: s.alertId,
        stage: s.currentStage,
        elapsed: Math.round((now - s.processedAt) / 1000),
      }));
  }
}

export const escalationEngine = new EscalationEngine();
