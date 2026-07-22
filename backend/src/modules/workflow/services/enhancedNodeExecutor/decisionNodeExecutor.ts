/**
 * Decision 节点执行器：自适应决策引擎
 *
 * 从原 enhancedNodeExecutor.ts 拆分（2026-07-08 P1-7 拆分）。
 * 根据风险评估节点的输出（riskScore + riskLevel），按用户定义规则匹配执行动作。
 */
import type { NodeResult } from '../../../../types';
import type { DecisionNodeConfig, DecisionAction, DecisionRule } from '../enhancedNodeTypes';

export function executeDecisionNode(
  config: DecisionNodeConfig,
  nodeResults: Record<string, NodeResult>
): { action: DecisionAction; reason: string; output: string } {
  // 从风险评估节点获取数据
  let riskScore = 0.5;
  let riskLevel = 'medium';

  if (config.riskSourceNodeId && nodeResults[config.riskSourceNodeId]?.metadata) {
    const meta = nodeResults[config.riskSourceNodeId].metadata as Record<string, string | number | boolean> || {};
    riskScore = (meta.overallRiskScore as number) || 0.5;
    riskLevel = (meta.riskLevel as string) || 'medium';
  }

  // 逐个匹配规则
  for (const rule of config.rules || []) {
    const matched = evaluateRule(rule, riskScore, riskLevel);
    if (matched) {
      return {
        action: rule.action,
        reason: rule.description || `匹配规则: ${rule.condition}`,
        output: `## 🎯 决策结果\n\n` +
          `- **动作**: ${rule.action}\n` +
          `- **原因**: ${rule.description || rule.condition}\n` +
          `- **风险分数**: ${(riskScore * 100).toFixed(0)}% | ${riskLevel}`,
      };
    }
  }

  // 默认动作
  const defaultAction = config.defaultAction || 'request_approval';
  return {
    action: defaultAction,
    reason: '未命中任何规则，使用默认动作',
    output: `## 🎯 决策结果\n\n` +
      `- **动作**: ${defaultAction}\n` +
      `- **原因**: 默认策略\n` +
      `- **风险分数**: ${(riskScore * 100).toFixed(0)}% | ${riskLevel}`,
  };
}

function evaluateRule(rule: DecisionRule, riskScore: number, riskLevel: string): boolean {
  try {
    // 简单的条件解析器
    const condition = rule.condition.replace(/\s+/g, ' ').trim();

    // risk_score < N
    const riskScoreMatch = condition.match(/risk_score\s*(<|<=|>|>=|==)\s*([\d.]+)/);
    if (riskScoreMatch) {
      const op = riskScoreMatch[1];
      const val = parseFloat(riskScoreMatch[2]);
      switch (op) {
        case '<': return riskScore < val;
        case '<=': return riskScore <= val;
        case '>': return riskScore > val;
        case '>=': return riskScore >= val;
        case '==': return Math.abs(riskScore - val) < 0.01;
      }
    }

    // risk_level == 'xxx'
    const levelMatch = condition.match(/risk_level\s*==\s*['"](\w+)['"]/);
    if (levelMatch) {
      return riskLevel === levelMatch[1];
    }

    // 复合条件：A && B 或 A || B
    if (condition.includes('&&')) {
      return condition.split('&&').every((part: string) => evaluateRule({ ...rule, condition: part.trim() }, riskScore, riskLevel));
    }
    if (condition.includes('||')) {
      return condition.split('||').some((part: string) => evaluateRule({ ...rule, condition: part.trim() }, riskScore, riskLevel));
    }

    return false;
  } catch {
    return false;
  }
}
