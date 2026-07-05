
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { alertAutoResponseService } from './alertAutoResponse/alertAutoResponseService';
import { remediationService } from '../../auto/services/remediationService';
import { knowledgeEngine } from '../../ai/services/KnowledgeEngine';
import { workflowsRepo, remediationPolicyRepository, processingRecordsRepo } from '../../../repositories';
import type { RemediationPolicy } from '../../../types';
import type { AlertProcessingRecord } from '../../../repositories/alertRepository/types';
import type {
  AlertProcessingContext,
  ProcessingDecision,
  ProcessingResult,
  ProcessingStrategy
} from '../../../types/unified-alert-processing';

const DEFAULT_CONFIG = {
  criticalSeverity: 'hybrid' as ProcessingStrategy,
  highSeverity: 'hybrid' as ProcessingStrategy,
  mediumSeverity: 'aars' as ProcessingStrategy,
  lowSeverity: 'workflow' as ProcessingStrategy,
  knowledgeThreshold: 0.8,
  maxAarsFallback: true
};

class AlertProcessor {
  private initialized = false;
  private config = DEFAULT_CONFIG;

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('✅ AlertProcessor 统一告警处理引擎已启动');
  }

  async processAlert(context: AlertProcessingContext): Promise<ProcessingResult> {
    const recordId = randomUUID();
    logger.info(`🔍 [统一处理] 开始处理告警 ${context.alertId}: ${context.title}`);

    // 保存初始记录
    this.saveProcessingRecord(recordId, context, 'pending');

    try {
      // 决策策略
      const decision = this.makeDecision(context);
      logger.info(`🤖 [统一处理] 策略决策: ${decision.strategy}, 原因: ${decision.reason}`);
      this.saveDecision(recordId, decision);

      // 执行策略
      let result: ProcessingResult;

      if (decision.strategy === 'aars') {
        result = await this.processWithAars(recordId, context);
      } else if (decision.strategy === 'workflow') {
        result = await this.processWithWorkflow(recordId, context, decision.workflowId!);
      } else if (decision.strategy === 'hybrid') {
        result = await this.processWithHybrid(recordId, context);
      } else {
        result = await this.processWithAuto(recordId, context);
      }

      // 最终状态
      this.finalizeProcessingRecord(recordId, result);
      logger.info(`✅ [统一处理] 告警 ${context.alertId} 处理完成: ${result.success}`);
      return result;

    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`❌ [统一处理] 告警 ${context.alertId} 处理失败: ${errorMsg}`);
      this.finalizeProcessingRecord(recordId, {
        success: false,
        strategy: 'auto',
        errorMessage: errorMsg
      });
      throw err;
    }
  }

  private makeDecision(context: AlertProcessingContext): ProcessingDecision {
    // 先查历史知识
    const knowledgeMatch = this.checkKnowledge(context);
    if (knowledgeMatch.found && knowledgeMatch.successRate >= this.config.knowledgeThreshold) {
      return {
        strategy: 'workflow',
        reason: `知识库匹配成功: 历史成功率 ${(knowledgeMatch.successRate * 100).toFixed(1)}%`,
        workflowId: knowledgeMatch.workflowId
      };
    }

    // 按严重程度
    if (context.severity === 'critical' || context.severity === 'high') {
      return {
        strategy: this.config.criticalSeverity,
        reason: `${context.severity} 等级告警: 默认采用 ${this.config.criticalSeverity} 策略`,
        aarsFallback: this.config.maxAarsFallback,
        workflowId: this.getDefaultWorkflow(context)
      };
    }

    if (context.severity === 'medium') {
      return {
        strategy: this.config.mediumSeverity,
        reason: `medium 等级告警: 默认采用 aars 策略`
      };
    }

    return {
      strategy: this.config.lowSeverity,
      reason: `${context.severity}/info: 默认采用 workflow 策略`,
      workflowId: this.getDefaultWorkflow(context)
    };
  }

  private async processWithAars(_recordId: string, context: AlertProcessingContext): Promise<ProcessingResult> {
    try {
      await alertAutoResponseService.triggerManually(context.alertId);
      const log = alertAutoResponseService.getByAlertId(context.alertId);
      return {
        success: log?.status === 'resolved',
        strategy: 'aars',
        aarsLogId: log?.id
      };
    } catch (err: unknown) {
      return {
        success: false,
        strategy: 'aars',
        errorMessage: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private async processWithWorkflow(
    _recordId: string,
    context: AlertProcessingContext,
    workflowId: string
  ): Promise<ProcessingResult> {
    try {
      const alert = {
        id: context.alertId,
        title: context.title,
        content: context.content,
        severity: context.severity,
        source: context.source,
        tags: []
      };

      const policy = await this.getOrCreatePolicy(context, workflowId);
      if (!policy) {
        throw new Error('找不到或无法创建修复策略');
      }

      const execution = await remediationService.triggerRemediation(policy, alert);

      return {
        success: execution.status === 'success' || execution.status === 'pending' || execution.status === 'waiting_approval',
        strategy: 'workflow',
        executionId: execution.id,
        remediationId: execution.id
      };
    } catch (err: unknown) {
      return {
        success: false,
        strategy: 'workflow',
        errorMessage: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private async processWithHybrid(recordId: string, context: AlertProcessingContext): Promise<ProcessingResult> {
    logger.info(`🤖 [Hybrid] 首先尝试 AARS 策略`);
    let result = await this.processWithAars(recordId, context);

    if (result.success) {
      return result;
    }

    if (this.config.maxAarsFallback) {
      logger.info(`🔄 [Hybrid] AARS 策略失败，回退到 workflow 策略`);
      result = await this.processWithWorkflow(recordId, context, this.getDefaultWorkflow(context));
      return { ...result, strategy: 'hybrid' };
    }

    return result;
  }

  private async processWithAuto(recordId: string, context: AlertProcessingContext): Promise<ProcessingResult> {
    return this.processWithHybrid(recordId, context);
  }

  private checkKnowledge(context: AlertProcessingContext): {
    found: boolean;
    workflowId?: string;
    successRate: number;
  } {
    try {
      const recommendations = knowledgeEngine.recommend(context.title, context.content, 3);
      if (recommendations.length === 0) return { found: false, successRate: 0 };

      // 取相似度最高且成功率 > 阈值 的推荐
      const best = recommendations[0];
      if (best.similarity >= 0.4 && best.entry.successRating >= 0.5) {
        // 如果该知识条目关联了 workflowId，直接用
        const workflowId = best.entry.workflowId || undefined;
        return {
          found: true,
          workflowId,
          successRate: best.entry.successRating,
        };
      }

      return { found: false, successRate: 0 };
    } catch (err) {
      logger.debug('知识库推荐查询失败', err);
    }
    return { found: false, successRate: 0 };
  }

  private getDefaultWorkflow(_context: AlertProcessingContext): string {
    const workflowId = workflowsRepo.getFirstTemplateId();
    if (workflowId) return workflowId;
    throw new Error('找不到可用的预设工作流');
  }

  private async getOrCreatePolicy(
    context: AlertProcessingContext,
    workflowId: string
  ): Promise<RemediationPolicy | undefined> {
    const existing = remediationPolicyRepository.findBySourceSeverityWorkflow(
      context.source, context.severity, workflowId
    ) as RemediationPolicy | undefined;

    if (existing) return existing;

    const id = randomUUID();
    remediationPolicyRepository.createMinimal({
      id,
      name: `临时策略: ${context.title.substring(0, 40)}`,
      description: '系统自动创建的统一策略',
      alert_source: context.source,
      alert_severity: context.severity,
      execution_mode: 'approval',
      workflow_id: workflowId,
    });

    return remediationPolicyRepository.getById(id) as RemediationPolicy | undefined;
  }

  private saveProcessingRecord(
    recordId: string,
    context: AlertProcessingContext,
    status: string
  ): void {
    try {
      processingRecordsRepo.create(recordId, context.alertId, status);
    } catch (err) {
      logger.debug('保存处理记录时出错', err);
    }
  }

  private saveDecision(recordId: string, decision: ProcessingDecision): void {
    try {
      processingRecordsRepo.updateDecision(recordId, decision.strategy, decision.reason);
    } catch (err) {
      logger.debug('保存策略决策时出错', err);
    }
  }

  private finalizeProcessingRecord(recordId: string, result: ProcessingResult): void {
    try {
      processingRecordsRepo.finalize(recordId, {
        status: result.success ? 'success' : 'failed',
        execution_id: result.executionId || null,
        task_id: result.taskId || null,
        aars_log_id: result.aarsLogId || null,
        remediation_id: result.remediationId || null,
        error_message: result.errorMessage || null,
      });
    } catch (err) {
      logger.debug('更新最终记录时出错', err);
    }
  }

  getRecordByAlertId(alertId: string): AlertProcessingRecord | undefined {
    return processingRecordsRepo.getByAlertId(alertId);
  }
}

export const alertProcessor = new AlertProcessor();
