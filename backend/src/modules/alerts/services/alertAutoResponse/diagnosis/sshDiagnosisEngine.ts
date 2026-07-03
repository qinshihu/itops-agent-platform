/**
 * =============================================================================
 * AARS v2 — SSH 诊断引擎
 *
 * 职责：
 *   1. 接收设备画像和告警信息
 *   2. 通过 strategyRecommender 获取推荐探针列表
 *   3. 通过 probeExecutor 并发执行探针
 *   4. 将探针结果交给 LLM 分析得出根因
 *   5. 返回诊断结果 + 修复建议
 * =============================================================================
 */

import { generateCompletion } from '../../../../ai/services/llm/llmService';
import { logger } from '../../../../../utils/logger';
import { strategyRecommender } from '../adaptive/strategyRecommender';
import { probeExecutor } from './probeExecutor';
import { riskAssessor } from '../adaptive/riskAssessor';
import { findProbesByAlertText } from '../probeUnit';
import type { ProbeUnit, ProbeResult, DeviceRuntimeProfile, RemediationPlan, RiskAssessment } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

export interface SshDiagnosisResult {
  probeResults: ProbeResult[];
  rawOutput: string;
  diagnosis: string;
  summary: string;
  rootCause: string;
  remediationPlan: RemediationPlan;
  riskAssessment: RiskAssessment;
  durationMs: number;
}

class SshDiagnosisEngine {
  /**
   * 执行 SSH 诊断全流程
   */
  async diagnose(
    device: DeviceRuntimeProfile,
    alertTitle: string,
    alertContent: string
  ): Promise<SshDiagnosisResult> {
    const start = Date.now();

    // Step 1: 推荐探针
    const recommendedProbes = strategyRecommender.recommend(alertTitle, alertContent, device, 6);

    // Step 2: 补充语义匹配探针（针对告警类型）
    const semanticProbes = findProbesByAlertText(alertTitle, alertContent);
    const allProbes = this.deduplicateProbes([...recommendedProbes, ...semanticProbes]);
    const selectedProbes = allProbes.slice(0, 8);

    logger.info(
      `[SSHDiagnosis] Running ${selectedProbes.length} probes on ${device.hostname} (${device.ip}) ` +
      `probes: ${selectedProbes.map(p => p.id).join(', ')}`
    );

    // Step 3: 并发执行探针
    const probeResults = await probeExecutor.executeProbes(selectedProbes, device, alertTitle);

    // Step 4: 合并探针输出
    const rawOutput = probeResults
      .filter(r => r.rawOutput)
      .map(r => `--- Probe: ${r.probeId} ---\n${r.rawOutput}`)
      .join('\n\n');

    // Step 5: LLM 分析
    const { diagnosis, summary, rootCause, remediationPlan } = await this.aiAnalyze(
      alertTitle, alertContent, rawOutput, device
    );

    // Step 6: 风险评估
    const riskAssessment = riskAssessor.assess(remediationPlan, this.extractSeverity(alertTitle), alertTitle);

    return {
      probeResults,
      rawOutput,
      diagnosis,
      summary,
      rootCause,
      remediationPlan,
      riskAssessment,
      durationMs: Date.now() - start,
    };
  }

  /**
   * AI 分析诊断输出 → 结构化根因 + 修复方案
   */
  private async aiAnalyze(
    alertTitle: string,
    alertContent: string,
    rawOutput: string,
    device: DeviceRuntimeProfile
  ): Promise<{
    diagnosis: string;
    summary: string;
    rootCause: string;
    remediationPlan: RemediationPlan;
  }> {
    const systemPrompt = `你是一个专业的IT运维根因分析专家，负责对服务器诊断输出进行根因分析。

输出格式要求（严格JSON格式，不要额外文字）：
\`\`\`json
{
  "summary": "一行摘要（50字内）",
  "rootCause": "详细的根因分析描述",
  "diagnosis": "详细的诊断说明",
  "remediationCommands": ["修复命令1", "修复命令2"],
  "rollbackCommands": ["回滚命令1", "回滚命令2"],
  "remediationSummary": "修复方案简述"
}
\`\`\`

要求：
- remediationCommands 必须是具体的可执行命令（bash）
- 如果命令无害（只读操作）则优先给出操作命令
- rollbackCommands 是 undo 命令（非必须）
- 如果无法确定，remediationCommands 只给诊断性命令`;

    const prompt = `## 告警信息
**标题**: ${alertTitle}
**内容**: ${alertContent || '(无详细内容)'}

## 设备信息
**主机名**: ${device.hostname}
**IP**: ${device.ip}

## 诊断输出
${rawOutput.substring(0, 10000)}

## 要求
请根据诊断输出分析根因并给出修复方案。`;

    try {
      const text = await generateCompletion(prompt, systemPrompt, 0.3);

      // 解析 JSON
      let parsed: any;
      try {
        const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text.match(/\{[\s\S]*\}/)?.[0];
        if (jsonStr) {
          parsed = JSON.parse(jsonStr);
        } else {
          throw new Error('No JSON found');
        }
      } catch {
        // 兜底：整个输出作为诊断
        const lines = text.trim().split('\n');
        return {
          diagnosis: text,
          summary: lines[0]?.substring(0, 100) || '诊断完成',
          rootCause: text.substring(0, 500),
          remediationPlan: {
            commands: [],
            rollbackCommands: [],
            summary: text.substring(0, 100),
            risk: { overallRiskScore: 0.5, dimensions: {} as any, suggestedAction: 'require_approval', thresholds: { autoThreshold: 0.25, approveThreshold: 0.55, manualThreshold: 0.80 } as any },
            requiresApproval: true,
          },
        };
      }

      const commands = (parsed.remediationCommands || []).map((cmd: string) => ({
        command: cmd,
        description: `修复: ${cmd.substring(0, 60)}`,
        timeoutMs: 30000,
        allowFailure: false,
      }));

      const rollbacks = (parsed.rollbackCommands || []).map((cmd: string) => ({
        command: cmd,
        description: `回滚: ${cmd.substring(0, 60)}`,
        timeoutMs: 30000,
        allowFailure: true,
      }));

      return {
        diagnosis: parsed.diagnosis || text,
        summary: parsed.summary || parsed.rootCause?.substring(0, 100) || '诊断完成',
        rootCause: parsed.rootCause || '无法确定根因',
        remediationPlan: {
          commands: commands.length > 0 ? commands : [{
            command: 'echo "No auto-remediation available. Manual intervention required."',
            description: '无自动修复方案，需要人工介入',
            timeoutMs: 5000,
            allowFailure: true,
          }],
          rollbackCommands: rollbacks,
          summary: parsed.remediationSummary || parsed.summary || '诊断完成',
          risk: {} as RiskAssessment,
          requiresApproval: true,
        },
      };
    } catch (err: unknown) {
      logger.error(`[SSHDiagnosis] AI analysis failed: ${getErrorMessage(err)}`);
      return {
        diagnosis: `❌ AI 分析失败: ${getErrorMessage(err)}`,
        summary: 'AI分析不可用',
        rootCause: '无法确定根因',
        remediationPlan: {
          commands: [],
          rollbackCommands: [],
          summary: 'AI分析不可用',
          risk: {} as RiskAssessment,
          requiresApproval: true,
        },
      };
    }
  }

  /** 从告警文本推断严重等级 */
  private extractSeverity(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes('disaster') || lower.includes('critical') || lower.includes('紧急')) return 'critical';
    if (lower.includes('high') || lower.includes('严重')) return 'high';
    if (lower.includes('warning') || lower.includes('告警')) return 'warning';
    return 'medium';
  }

  /** 去重探针 */
  private deduplicateProbes(probes: ProbeUnit[]): ProbeUnit[] {
    const seen = new Set<string>();
    return probes.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }
}

export const sshDiagnosisEngine = new SshDiagnosisEngine();
