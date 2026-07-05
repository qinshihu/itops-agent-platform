/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * AARS v2 — SNMP 诊断引擎（网络设备）
 *
 * 职责：
 *   1. 对无 SSH 凭证但可 SNMP 可达的网络设备执行诊断
 *   2. 通过 SNMP 探针采集接口、CPU、内存、温度等指标
 *   3. LLM 分析诊断
 *   4. 输出诊断结果（网络设备不自动执行修复，全走审核）
 * =============================================================================
 */

import { generateCompletion } from '../../../../ai/services/llm/llmService';
import { snmpInspectionRepo } from '../../../../../repositories';
import { logger } from '../../../../../utils/logger';
import { strategyRecommender } from '../adaptive/strategyRecommender';
import { probeExecutor } from './probeExecutor';
import { PROBE_INDEX } from '../probeUnit';
import type { ProbeUnit, ProbeResult, DeviceRuntimeProfile } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';

export interface SnmpDiagnosisResult {
  probeResults: ProbeResult[];
  rawOutput: string;
  diagnosis: string;
  summary: string;
  rootCause: string;
  findings: string[];
  recommendations: string[];
  hasCriticalIssues: boolean;
  durationMs: number;
}

class SnmpDiagnosisEngine {
  /**
   * 执行 SNMP 诊断
   */
  async diagnose(
    device: DeviceRuntimeProfile,
    alertTitle: string,
    alertContent: string
  ): Promise<SnmpDiagnosisResult> {
    const start = Date.now();

    // Step 1: 获取全量 SNMP 探针
    const snmpProbes = this.getSnmpProbes();
    const recommended = strategyRecommender.recommend(alertTitle, alertContent, device, 5);
    const snmpRecommended = recommended.filter(p => p.oids && p.oids.length > 0);

    // 如果推荐没有 SNMP 探针，至少跑一组基础 SNMP 探针
    const probesToRun = snmpRecommended.length > 0
      ? snmpRecommended
      : snmpProbes.slice(0, 5);

    logger.info(
      `[SNMPDiagnosis] Running ${probesToRun.length} SNMP probes on ${device.hostname}`
    );

    // Step 2: 并发执行 SNMP 探针
    const probeResults = await probeExecutor.executeProbes(probesToRun, device, alertTitle);

    // Step 3: 补充 SNMP 历史数据
    const historyData = this.getSnmpHistoryData(device.deviceId);

    // Step 4: 合并输出
    const rawOutput = [
      '=== SNMP 实时探测结果 ===',
      ...probeResults.map(r => `--- ${r.probeId} ---\n${r.rawOutput}`),
      '',
      '=== SNMP 历史数据 ===',
      historyData,
    ].join('\n\n');

    // Step 5: LLM 分析
    const { diagnosis, summary, rootCause, findings, recommendations } = await this.analyzeWithLLM(
      alertTitle, alertContent, rawOutput, device
    );

    // Step 6: 判断是否有严重问题
    const hasCriticalIssues = findings.some(f =>
      f.includes('异常') || f.includes('故障') || f.includes('DOWN') ||
      f.includes('error') || f.includes('critical')
    );

    return {
      probeResults,
      rawOutput,
      diagnosis,
      summary,
      rootCause,
      findings,
      recommendations,
      hasCriticalIssues,
      durationMs: Date.now() - start,
    };
  }

  /**
   * 获取仅 SNMP 探针列表
   */
  private getSnmpProbes(): ProbeUnit[] {
    return PROBE_INDEX
      ? Array.from(PROBE_INDEX.values()).filter(p => p.oids && p.oids.length > 0)
      : [];
  }

  /**
   * 获取 SNMP 历史巡检/指标数据
   */
  private getSnmpHistoryData(deviceId: string): string {
    try {
      const parts: string[] = [];

      // 从巡检历史取
      const inspections = snmpInspectionRepo.listRecentByDeviceId(deviceId, 3);

      if (inspections.length > 0) {
        parts.push('【最近巡检记录】');
        for (const insp of inspections) {
          parts.push(`- ${insp.created_at}: ${insp.inspection_type} [${insp.status}] ${insp.summary || ''}`);
        }
      }

      // 从接口指标取
      const metrics = snmpInspectionRepo.listRecentInterfaceMetrics(deviceId, 10);

      if (metrics.length > 0) {
        parts.push('【最近接口指标】');
        for (const m of metrics) {
          const status = m.if_oper_status === 1 ? 'UP' : (m.if_oper_status === 2 ? 'DOWN' : '未知');
          parts.push(`- ${m.interface_name}: ${status} (入错=${m.if_in_errors}, 出错=${m.if_out_errors}) @ ${m.sampled_at}`);
        }
      }

      return parts.join('\n') || '（无历史数据）';
    } catch {
      return '（获取历史数据失败）';
    }
  }

  /**
   * LLM 分析诊断输出
   */
  private async analyzeWithLLM(
    alertTitle: string,
    alertContent: string,
    rawOutput: string,
    device: DeviceRuntimeProfile
  ): Promise<{
    diagnosis: string;
    summary: string;
    rootCause: string;
    findings: string[];
    recommendations: string[];
  }> {
    const systemPrompt = `你是一个网络运维专家，负责分析网络设备的 SNMP 诊断数据。

输出格式要求（严格JSON格式）：
\`\`\`json
{
  "summary": "一行摘要（50字内）",
  "rootCause": "根因分析",
  "diagnosis": "详细诊断说明",
  "findings": ["发现1", "发现2", "发现3"],
  "recommendations": ["建议1", "建议2"]
}
\`\`\`

注意事项：
- 网络设备不可自动执行修复命令
- 所有建议都应该是手动操作建议`;

    const prompt = `## 告警
**标题**: ${alertTitle}
**内容**: ${alertContent || ''}

## 设备
**设备**: ${device.hostname} (${device.ip})

## SNMP 诊断数据
${rawOutput.substring(0, 8000)}

## 要求
分析 SNMP 数据，判断设备运行状态，给出诊断结论。`;

    try {
      const text = await generateCompletion(prompt, systemPrompt, 0.3);

      let parsed: any;
      try {
        const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : text.match(/\{[\s\S]*\}/)?.[0];
        if (jsonStr) parsed = JSON.parse(jsonStr);
        else throw new Error('No JSON');
      } catch {
        return {
          diagnosis: text,
          summary: 'SNMP 诊断完成',
          rootCause: text.substring(0, 300),
          findings: ['请检查 SNMP 数据'],
          recommendations: ['进一步人工排查'],
        };
      }

      return {
        diagnosis: parsed.diagnosis || text,
        summary: parsed.summary || 'SNMP 诊断完成',
        rootCause: parsed.rootCause || '无法确定根因',
        findings: parsed.findings || [],
        recommendations: parsed.recommendations || [],
      };
    } catch (err: unknown) {
      logger.error(`[SNMPDiagnosis] AI analysis failed: ${getErrorMessage(err)}`);
      return {
        diagnosis: `❌ AI 分析失败: ${getErrorMessage(err)}`,
        summary: 'AI 分析不可用',
        rootCause: '无法确定根因',
        findings: ['AI分析不可用'],
        recommendations: ['人工检查网络设备'],
      };
    }
  }
}

export const snmpDiagnosisEngine = new SnmpDiagnosisEngine();
