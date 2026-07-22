/**
 * Risk Assess 节点执行器：三维风险量化评分
 *
 * 从原 enhancedNodeExecutor.ts 拆分（2026-07-08 P1-7 拆分）。
 * 三维度：操作风险 / 时间紧迫度 / AI 置信度，综合分数驱动建议动作。
 */
import type { NodeResult, ExecutionContext } from '../../../../types';
import type { RiskAssessNodeConfig, RiskAssessmentResult } from '../enhancedNodeTypes';

export function executeRiskAssessNode(
  config: RiskAssessNodeConfig,
  executionContext: ExecutionContext,
  previousResults: string[]
): NodeResult {
  const severity = config.alertSeverity || 'medium';
  const _title = config.alertTitle || '未知告警';

  // 从上下文或变量中提取修复计划信息
  const planOutput = config.planSourceNodeId
    ? previousResults.find((r: string) => r.includes('修复') || r.includes('命令')) || previousResults[previousResults.length - 1] || ''
    : previousResults.join('\n').substring(0, 2000);

  // 分析命令风险因子
  const hasServiceRestart = /restart|reload|systemctl\s+restart/i.test(planOutput);
  const hasReboot = /reboot|shutdown/i.test(planOutput);
  const hasConfigModify = /sed\s+-i|echo\s+.*>\s*\/etc|chmod|chown|sysctl/i.test(planOutput);
  const hasDataDelete = /rm\s+-rf|delete|drop\s+table|truncate/i.test(planOutput);
  const mayCauseDowntime = /stop|kill|pkill|killall/i.test(planOutput);
  const isReadonly = !hasServiceRestart && !hasReboot && !hasConfigModify && !hasDataDelete && !mayCauseDowntime;
  const hasRollback = /回滚|rollback|revert|undo/i.test(planOutput);

  // 操作风险评估
  const factors: Record<string, { triggered: boolean; weight: number }> = {
    isReadonly: { triggered: isReadonly, weight: 0 },
    requiresServiceRestart: { triggered: hasServiceRestart, weight: 0.25 },
    requiresMachineReboot: { triggered: hasReboot, weight: 0.35 },
    modifiesConfig: { triggered: hasConfigModify, weight: 0.20 },
    deletesData: { triggered: hasDataDelete, weight: 0.40 },
    mayCauseDowntime: { triggered: mayCauseDowntime, weight: 0.30 },
  };

  let operationalRiskScore = Object.values(factors)
    .filter((f: { triggered: boolean; weight: number }) => f.triggered)
    .reduce((sum: number, f: { triggered: boolean; weight: number }) => sum + f.weight, 0);

  const highRiskCount = Object.values(factors).filter((f: { triggered: boolean; weight: number }) => f.triggered && f.weight >= 0.25).length;
  if (highRiskCount >= 2) operationalRiskScore = Math.min(1.0, operationalRiskScore + 0.2);

  // 时间紧迫度评估
  const severityMap: Record<string, number> = {
    disaster: 1.0, critical: 0.9, high: 0.7, warning: 0.4,
    medium: 0.3, average: 0.3, info: 0.1, low: 0.1,
  };
  const severityScore = severityMap[severity.toLowerCase()] || 0.3;
  const hour = new Date().getHours();
  const isOffHours = hour < 8 || hour > 20 || [0, 6].includes(new Date().getDay());
  const urgencyScore = Math.min(1.0, severityScore * 0.6 + (isOffHours ? 0.2 : 0));

  // AI 置信度评估
  let confidenceScore = 0.5;
  if (hasRollback) confidenceScore += 0.15;
  if (planOutput.length > 200) confidenceScore += 0.1;
  if ((planOutput.match(/&&|;/g) || []).length > 2) confidenceScore += 0.1;
  if (isReadonly) confidenceScore += 0.15;
  confidenceScore = Math.min(1.0, confidenceScore);

  // 综合风险分数
  const overallRiskScore = operationalRiskScore * 0.5 + (1 - urgencyScore) * 0.2 + (1 - confidenceScore) * 0.3;

  // 动态阈值
  const thresholds = {
    auto: config.thresholds?.auto ?? (confidenceScore > 0.85 ? 0.45 : confidenceScore > 0.7 ? 0.35 : 0.25),
    approve: config.thresholds?.approve ?? (confidenceScore > 0.85 ? 0.75 : confidenceScore > 0.7 ? 0.65 : 0.55),
    manual: config.thresholds?.manual ?? 0.85,
  };

  // 确定建议动作
  let suggestedAction: RiskAssessmentResult['suggestedAction'];
  if (overallRiskScore <= thresholds.auto) suggestedAction = 'auto_execute';
  else if (overallRiskScore <= thresholds.approve) suggestedAction = 'require_approval';
  else if (overallRiskScore <= thresholds.manual) suggestedAction = 'manual_only';
  else suggestedAction = 'escalate';

  // 风险级别
  let riskLevel: RiskAssessmentResult['riskLevel'];
  if (overallRiskScore < 0.25) riskLevel = 'low';
  else if (overallRiskScore < 0.55) riskLevel = 'medium';
  else if (overallRiskScore < 0.80) riskLevel = 'high';
  else riskLevel = 'critical';

  const dimensions = {
    operationalRisk: { score: operationalRiskScore, factors },
    urgencyScore,
    confidenceScore,
  };

  const detail = `操作风险:${(operationalRiskScore * 100).toFixed(0)}% | 紧迫度:${(urgencyScore * 100).toFixed(0)}% | 置信度:${(confidenceScore * 100).toFixed(0)}%`;

  const output = `## 🔍 风险评估结果\n\n` +
    `| 维度 | 分数 |\n|------|------|\n` +
    `| 操作风险 | ${(operationalRiskScore * 100).toFixed(0)}% |\n` +
    `| 时间紧迫度 | ${(urgencyScore * 100).toFixed(0)}% |\n` +
    `| AI 置信度 | ${(confidenceScore * 100).toFixed(0)}% |\n` +
    `| **综合风险** | **${(overallRiskScore * 100).toFixed(0)}%** |\n\n` +
    `- **风险级别**: ${riskLevel}\n` +
    `- **建议动作**: ${suggestedAction}\n` +
    `- **详情**: ${detail}`;

  return {
    status: 'success',
    output,
    metadata: { overallRiskScore, dimensions, riskLevel, suggestedAction, thresholds, detail },
  };
}
