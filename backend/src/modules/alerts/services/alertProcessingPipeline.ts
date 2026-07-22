/**
 * 告警处理流水线服务
 *
 * 职责：告警创建后的全流程处理编排（RCA → 统一处理 → WebSocket 推送）
 * 从 alertRoutes.ts 提取，解决路由层包含业务逻辑的 P1#4 问题
 */

import { getIOInstance } from '../../../shared/websocket/io';
import { emitToAlerts } from '../../../shared/websocket/handler';
import { logger } from '../../../utils/logger';
import { settingsRepository } from '../../../repositories';
import { rootCauseAnalysisService } from '../../ai/services/rca/rootCauseAnalysisService';
import { alertProcessor } from './AlertProcessor';

export interface AlertProcessingContext {
  id: string;
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  rawSeverity?: string;
  title: string;
  content: string;
  tags: string[];
}

export async function runAlertProcessingPipeline(ctx: AlertProcessingContext): Promise<void> {
  const io = getIOInstance();
  try {
    const { id, source, severity, rawSeverity, title, content, tags } = ctx;

    emitToAlerts(io!, 'remediation:started', {
      alertId: id,
      title,
      timestamp: new Date().toISOString()
    });

    // 自动根因分析
    const autoRCAEnabled = settingsRepository.getValue('auto_root_cause_enabled');
    if (autoRCAEnabled === 'true') {
      logger.info('🔍 Auto RCA triggered for alert:', id);
      rootCauseAnalysisService.analyzeByAlert(id, title, content).catch((err) => {
        logger.error('Failed to auto-trigger RCA for alert:', err);
      });
    }

    // ── 统一告警处理入口（AARS + 工作流 智能决策）──
    alertProcessor.processAlert({
      alertId: id,
      title,
      content,
      severity,
      source,
      metadata: { tags, rawSeverity }
    }).then((result) => {
      emitToAlerts(io!, 'remediation:result', {
        alertId: id,
        policyId: result.executionId || result.taskId || '',
        policyName: `统一处理: ${result.strategy}`,
        executionId: result.executionId || result.taskId,
        status: result.success ? 'success' : 'failed',
        timestamp: new Date().toISOString()
      });
    }).catch((err: Error) => {
      logger.error(`AlertProcessor failed for ${id}:`, err);
    });
  } catch (error) {
    logger.error('Failed to process alert remediation:', error);
    emitToAlerts(io!, 'remediation:error', {
      alertId: ctx.id,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}
