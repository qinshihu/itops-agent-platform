/**
 * =============================================================================
 * AARS v2 — 三维风险量化评分引擎
 *
 * 核心理念：
 *   不做 true/false 二分判断，而是从三个维度量化风险：
 *   ① 操作风险（0~1）：这个修复操作本身有多危险
 *   ② 时间紧迫度（0~1）：多长时间窗口内必须处理
 *   ③ AI 置信度（0~1）：AI 对这个方案有多少把握
 *
 *   综合分数 = 操作风险 * 0.5 + (1 - 紧迫度) * 0.2 + (1 - 置信度) * 0.3
 *   分数越低 → 越安全 → 越可能自动执行
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import type { RiskAssessment, RiskDimensions, RemediationPlan } from '../types';

// 工作日时间窗口
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

class RiskAssessor {
  /**
   * 对修复方案做三维风险评估
   */
  assess(remediation: RemediationPlan, alertSeverity: string, _alertTitle: string): RiskAssessment {
    const operationalRisk = this.evaluateOperationalRisk(remediation);
    const urgency = this.evaluateUrgency(alertSeverity);
    const confidence = this.evaluateConfidence(remediation);

    const overall = Math.round(
      operationalRisk.score * 0.50 +
      (1 - urgency.score) * 0.20 +
      (1 - confidence.score) * 0.30
    );

    // 动态阈值
    const thresholds = this.computeDynamicThresholds(confidence);

    let suggestedAction: RiskAssessment['suggestedAction'];
    if (overall <= thresholds.autoThreshold) {
      suggestedAction = 'auto_execute';
    } else if (overall <= thresholds.approveThreshold) {
      suggestedAction = 'require_approval';
    } else if (overall <= thresholds.manualThreshold) {
      suggestedAction = 'manual_only';
    } else {
      suggestedAction = 'escalate';
    }

    logger.info(
      `[RiskAssessor] overall=${overall.toFixed(3)} ` +
      `opRisk=${operationalRisk.score.toFixed(3)} urgency=${urgency.score.toFixed(3)} ` +
      `confidence=${confidence.score.toFixed(3)} action=${suggestedAction}`
    );

    return {
      overallRiskScore: overall,
      dimensions: { operationalRisk, urgencyScore: urgency, confidenceScore: confidence },
      suggestedAction,
      thresholds,
    };
  }

  /**
   * ① 操作风险评估
   * 分析修复命令本身的危险性
   */
  private evaluateOperationalRisk(remediation: RemediationPlan): RiskDimensions['operationalRisk'] {
    const allCommands = remediation.commands.map(c => c.command);
    const cmdText = allCommands.join('\n').toLowerCase();

    const factors = {
      isReadonly: this.isAllReadonly(allCommands),
      requiresServiceRestart: /\b(restart|reload|stop)\b/i.test(cmdText),
      requiresMachineReboot: /\b(reboot|shutdown|poweroff|init 6)\b/i.test(cmdText),
      modifiesConfig: /\b(sed -i|echo.*>|cat.*>|cp|mv|rm|chmod|chown|write memory|copy running-config)\b/i.test(cmdText),
      deletesData: /(\brm\b.*-\w*f\b)|(\brm\b.*-rf\b)|(\btruncate\b)|(\bdelete\b)/i.test(cmdText),
      mayCauseDowntime: /\b(reload|restart|reboot|shutdown|ifdown|service.*stop|systemctl.*stop)\b/i.test(cmdText),
    };

    // 加权计算
    let score = 0;
    if (factors.isReadonly) score += 0;
    if (factors.requiresServiceRestart) score += 0.25;
    if (factors.requiresMachineReboot) score += 0.35;
    if (factors.modifiesConfig) score += 0.20;
    if (factors.deletesData) score += 0.40;
    if (factors.mayCauseDowntime) score += 0.30;

    // 风险补偿：如果同时有多个高风险因素，叠加
    const highRiskCount = [factors.requiresMachineReboot, factors.deletesData, factors.mayCauseDowntime].filter(Boolean).length;
    if (highRiskCount >= 2) score = Math.min(1, score + 0.2);

    return { score: Math.min(1, score), factors };
  }

  /**
   * 判断所有命令是否都是只读的
   */
  private isAllReadonly(commands: string[]): boolean {
    if (commands.length === 0) return true;

    const readonlyPatterns = [
      /^(ps|top|free|df|du|uptime|cat\b|echo\b|dmesg|journalctl|iostat|vmstat|ss|netstat|ip\b|ifconfig|pstree|systemctl\s+status|systemctl\s+list|systemctl\s+is|docker\s+ps|docker\s+stats|getenforce|sestatus|aa-status|hostnamectl|uname|ping|traceroute|nslookup|dig|curl|wget)/i,
    ];

    return commands.every(cmd => readonlyPatterns.some(p => p.test(cmd.trim())));
  }

  /**
   * ② 时间紧迫度评分
   * 综合考虑告警等级、时间窗口、影响范围
   */
  private evaluateUrgency(alertSeverity: string): RiskDimensions['urgencyScore'] {
    const severityMap: Record<string, number> = {
      'disaster': 1.0,
      'critical': 0.9,
      'high': 0.7,
      'warning': 0.4,
      'medium': 0.3,
      'average': 0.3,
      'info': 0.1,
      'low': 0.1,
    };

    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const isWeekendOrNight = dayOfWeek === 0 || dayOfWeek === 6 || hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR;

    const severity = severityMap[alertSeverity] || 0.3;

    // 加权
    const score = severity * 0.6 + (isWeekendOrNight ? 0.2 : 0);

    return {
      score: Math.min(1, score),
      factors: {
        severity: alertSeverity,
        isWeekendOrNight,
        affectedUsersCount: 0,
        isDownstreamDependency: false,
      },
    };
  }

  /**
   * ③ AI 置信度评分
   * 从修复方案推断 LLM 的确定程度
   */
  private evaluateConfidence(remediation: RemediationPlan): RiskDimensions['confidenceScore'] {
    // 如果修复命令有对应的回滚命令 → 置信度更高
    const hasRollback = remediation.rollbackCommands.length > 0;

    // 修复方案摘要的详细程度
    const summaryDetail = remediation.summary ? remediation.summary.length : 0;

    // 多个证据线：多条命令
    const evidenceCount = remediation.commands.length;

    // 历史成功率（从知识库）
    const similarCaseExists = false; // 运行时由反馈环路更新
    const similarCaseSuccess: 'high' | 'mid' | 'low' | 'none' = 'none';

    let score = 0.5; // 基础分

    // 有回滚命令 +0.15
    if (hasRollback) score += 0.15;
    // 摘要详细 +0.1
    if (summaryDetail > 50) score += 0.1;
    // 多条命令 +0.1
    if (evidenceCount > 2) score += 0.1;
    // 命令含只读 +0.1
    if (remediation.commands.every(c => this.isSingleReadonly(c.command))) score += 0.15;

    return {
      score: Math.min(1, score),
      factors: {
        rootCauseCertainty: score,
        similarCaseExists,
        similarCaseSuccess,
        remediationTested: false,
        multipleEvidenceLines: evidenceCount > 1,
      },
    };
  }

  private isSingleReadonly(cmd: string): boolean {
    const readonlyPatterns = [
      /^(ps|top|free|df|du|uptime|cat\b|echo\b|dmesg|journalctl|iostat|vmstat|ss|netstat|ip\b|ifconfig|pstree|systemctl\s+status|systemctl\s+list|systemctl\s+is|docker\s+ps|docker\s+stats|getenforce|sestatus|aa-status|hostnamectl|uname|ping|traceroute|nslookup|dig|curl|wget)/i,
    ];
    return readonlyPatterns.some(p => p.test(cmd.trim()));
  }

  /**
   * 动态阈值计算
   *
   * 核心逻辑：置信度高 → 自动阈值放宽（更多自动执行）
   *           置信度低 → 自动阈值收紧（更多需要批准）
   */
  private computeDynamicThresholds(confidence: RiskDimensions['confidenceScore']): RiskAssessment['thresholds'] {
    let autoThreshold = 0.25;
    let approveThreshold = 0.55;
    const manualThreshold = 0.80;

    // 置信度 > 0.7 → 更激进
    if (confidence.score > 0.7) {
      autoThreshold = 0.35;
      approveThreshold = 0.65;
    }
    // 置信度 > 0.85 → 非常激进
    if (confidence.score > 0.85) {
      autoThreshold = 0.45;
      approveThreshold = 0.75;
    }
    // 置信度 < 0.3 → 保守
    if (confidence.score < 0.3) {
      autoThreshold = 0.15;
      approveThreshold = 0.45;
    }

    return { autoThreshold, approveThreshold, manualThreshold };
  }
}

export const riskAssessor = new RiskAssessor();
