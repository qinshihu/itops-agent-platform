import { alertRepository, rcaRepository } from '../../../../../repositories';
import type { RootCauseAnalysis, CreateRCAInput, UpdateRCAInput } from '../../../../../repositories';
import { logger } from '../../../../../utils/logger';
import { aiRemediationService } from '../../remediation/aiRemediationService';
import {
  performRuleEngineAnalysis,
  generateFallbackAnalysis,
  performLLMAnalysis,
  findDeviceByAlert,
  extractCommandsFromRecommendations,
  collectContext,
  analyzeWithLLM,
} from './rcaAnalyzer';

// Re-export types for external consumers
export type { RootCauseAnalysis, CreateRCAInput, UpdateRCAInput } from '../../../../../repositories';

class RootCauseAnalysisService {
  create(input: CreateRCAInput): RootCauseAnalysis {
    return rcaRepository.create(input);
  }

  update(id: string, input: UpdateRCAInput): RootCauseAnalysis | undefined {
    return rcaRepository.update(id, input);
  }

  list(): RootCauseAnalysis[] {
    return rcaRepository.list();
  }

  get(id: string): RootCauseAnalysis | undefined {
    return rcaRepository.getById(id);
  }

  getByAlert(alertId: string): RootCauseAnalysis | undefined {
    return rcaRepository.getByAlertId(alertId);
  }

  delete(id: string): boolean {
    return rcaRepository.deleteById(id);
  }

  getStats() {
    return rcaRepository.getStats();
  }

  async analyzeByAlert(alertId: string, alertTitle: string, alertContent: string): Promise<RootCauseAnalysis | undefined> {
    const rca = this.create({
      alert_id: alertId,
      title: `自动根因分析: ${alertTitle}`,
      description: alertContent
    });

    return this.analyze(rca.id);
  }

  async analyze(id: string): Promise<RootCauseAnalysis | undefined> {
    const existing = rcaRepository.getById(id);
    if (!existing) {
      return undefined;
    }

    rcaRepository.update(id, { status: 'analyzing' });

    try {
      let analysisResult;

      try {
        analysisResult = await performLLMAnalysis(existing);
      } catch (llmError) {
        logger.info(`🔄 [RCA] LLM analysis failed, falling back to local rule engine: ${(llmError as Error).message}`);
        try {
          analysisResult = performRuleEngineAnalysis(existing);
        } catch (ruleError) {
          logger.warn(`⚠️ [RCA] Rule engine also failed: ${(ruleError as Error).message}, using default fallback`);
          analysisResult = generateFallbackAnalysis(existing);
        }
      }

      return rcaRepository.update(id, analysisResult);
    } catch (error) {
      rcaRepository.update(id, { status: 'failed' });
      throw error;
    }
  }
  async autoAnalyze(alertId: string): Promise<RootCauseAnalysis | undefined> {
    try {
      logger.info(`🔍 [RCA] 开始自动根因分析: alertId=${alertId}`);

      const alert = alertRepository.getById(alertId);

      if (!alert) {
        logger.warn(`⚠️ [RCA] 告警不存在: ${alertId}`);
        return undefined;
      }

      const context = await collectContext(alert);
      const analysisResult = await analyzeWithLLM(alert, context);

      if (!analysisResult) {
        logger.warn(`⚠️ [RCA] LLM分析返回空结果: ${alertId}`);
        return undefined;
      }

      const rca = this.create({
        alert_id: alertId,
        title: `自动根因分析: ${alert.title}`,
        description: alert.content
      });

      this.update(rca.id, {
        status: 'completed',
        ...analysisResult
      });

      logger.info(`✅ [RCA] 自动根因分析完成: rcaId=${rca.id}`);

      // [断裂点1修复] 桥接到aiRemediationService
      try {
        // 查找关联设备
        const device = findDeviceByAlert(alertId);
        if (device && analysisResult.recommendations && analysisResult.recommendations.length > 0) {
          // 从 recommendations 中提取具体的修复命令
          const commands = extractCommandsFromRecommendations(analysisResult.recommendations);
          if (commands.length > 0) {
            // 调用 aiRemediationService
            logger.info(`🔧 [RCA → AI Remediation] 触发自动修复: alertId=${alertId}, commands=${commands}`);
            await aiRemediationService.createAndExecute({
              alertId: alertId,
              alertTitle: alert.title,
              alertContent: alert.content,
              alertSeverity: alert.severity,
              deviceId: device.id,
              deviceName: device.name,
              deviceIp: device.ip_address,
              deviceType: device.device_type,
              diagnosis: analysisResult.root_cause || 'AI诊断完成',
              remediationCommands: commands,
              riskLevel: alert.severity === 'critical' || alert.severity === 'high' ? 'high' : 'medium'
            });
          }
        }
      } catch (remediationError) {
        logger.warn(`⚠️ [RCA] 触发AI修复失败: ${remediationError instanceof Error ? remediationError.message : String(remediationError)}`);
      }

      return this.get(rca.id);
    } catch (error) {
      logger.error(`❌ [RCA] 自动根因分析失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      throw error;
    }
  }
}

export const rootCauseAnalysisService = new RootCauseAnalysisService();