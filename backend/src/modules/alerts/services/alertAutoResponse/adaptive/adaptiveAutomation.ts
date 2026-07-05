/**
 * =============================================================================
 * AARS v2 — 自适应自动化决策引擎（渐进式信任积累）
 *
 * 核心思想：
 *   不搞"自动/审核"的二分法，而是渐进式信任积累。
 *   每一次人工审核"同意"都是系统学习的机会。
 *   当同类操作被批准 N 次 → 自动降低其自动化阈值。
 *   但保留安全规则：破坏性操作永远需要审核。
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import type { RiskAssessment, TrustRecord, RemediationPlan } from '../types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getErrorMessage } from '../../../../../utils/errorHelpers';
import { automataTrustRepo } from '../../../../../repositories';

// 安全规则：这些操作始终需要审核
const DESTRUCTIVE_PATTERNS = [
  /\brm\b.*-rf\s+\//,          // rm -rf /
  /\brm\b.*-rf\s+(\/\w+)/,     // rm -rf /xxx
  /\bmkfs/,                     // 格式化
  /\bfdisk/,                    // 分区
  /\bdd if=/,                   // dd 写入
  /\bchmod\s+777/,              // 777 权限
  /\bpasswd\b/,                 // 改密码
  /\buserdel\b/,                // 删用户
  /\bgroupdel\b/,               // 删组
  /\binit\s+0\b/,               // shutdown
  /\bpoweroff\b/,               // 关机
  /\breboot\b/,                 // 重启
  /\bwrite\s+memory\b/,         // 保存配置（网络设备）
  /\breload\s+(cold|warm)\b/,   // 重载配置
];

class AdaptiveAutomationEngine {
  private trustMatrix = new Map<string, TrustRecord>();
  private lastLoadTime = 0;
  private readonly LOAD_INTERVAL_MS = 60_000; // 1 分钟

  /** 确保信任表存在 */
  private ensureTrustTable(): void {
    automataTrustRepo.ensureTable();
  }

  /** 加载信任矩阵 */
  private loadTrustMatrix(): void {
    if (Date.now() - this.lastLoadTime < this.LOAD_INTERVAL_MS) return;
    this.lastLoadTime = Date.now();
    this.ensureTrustTable();

    try {
      const rows = automataTrustRepo.listAll();
      for (const row of rows) {
        this.trustMatrix.set(row.operation_key, {
          operationKey: row.operation_key,
          approvalCount: row.approval_count,
          rejectionCount: row.rejection_count,
          successCount: row.success_count,
          failureCount: row.failure_count,
          successRate: row.success_rate,
          lastUpdated: new Date(row.last_updated || Date.now()).getTime(),
        });
      }
    } catch {
      // 表可能不存在
    }
  }

  /**
   * 主决策入口
   *
   * @returns 'auto' | 'approve' | 'manual' | 'blocked'
   */
  decide(remediation: RemediationPlan, riskAssessment: RiskAssessment): 'auto' | 'approve' | 'manual' | 'blocked' {
    this.loadTrustMatrix();

    // ── 安全规则 1: 破坏性操作 —— 始终需要审核 ──
    if (this.isDestructiveOperation(remediation)) {
      logger.info('[AdaptiveAutomation] Destructive operation detected, requiring approval');
      return 'approve';
    }

    // ── 安全规则 2: 紧急 + 高置信度 —— 自动执行（即使有风险） ──
    const isUrgent = riskAssessment.dimensions.urgencyScore.score > 0.8;
    const isHighConfidence = riskAssessment.dimensions.confidenceScore.score > 0.7;
    if (isUrgent && isHighConfidence) {
      logger.info('[AdaptiveAutomation] Urgent + high confidence → auto execute');
      return 'auto';
    }

    // ── 查询信任矩阵，获取历史成功率 ──
    const operationKey = this.buildOperationKey(remediation);
    const trust = this.trustMatrix.get(operationKey);
    let autoThreshold = riskAssessment.thresholds.autoThreshold;

    if (trust && trust.approvalCount >= 3) {
      // 基础信任：被批准 3+ 次
      if (trust.successRate > 0.9) {
        autoThreshold = Math.min(0.45, autoThreshold + 0.15); // 放宽
        logger.info(`[AdaptiveAutomation] Trust level HIGH (approvals=${trust.approvalCount}, rate=${(trust.successRate * 100).toFixed(0)}%) → threshold=${autoThreshold.toFixed(3)}`);
      }
      if (trust.approvalCount >= 15 && trust.successRate > 0.95) {
        autoThreshold = Math.min(0.60, autoThreshold + 0.30); // 非常信任
        logger.info(`[AdaptiveAutomation] Trust level VERY HIGH (approvals=${trust.approvalCount}) → threshold=${autoThreshold.toFixed(3)}`);
      }
    } else if (trust && trust.rejectionCount >= 3) {
      // 多次被拒绝 → 收紧
      autoThreshold = Math.max(0.05, autoThreshold - 0.10);
      logger.info(`[AdaptiveAutomation] Trust level LOW (rejections=${trust.rejectionCount}) → threshold=${autoThreshold.toFixed(3)}`);
    }

    // ── 最终决策 ──
    if (riskAssessment.overallRiskScore <= autoThreshold) return 'auto';
    if (riskAssessment.overallRiskScore <= riskAssessment.thresholds.approveThreshold) return 'approve';
    if (riskAssessment.overallRiskScore <= riskAssessment.thresholds.manualThreshold) return 'manual';
    return 'blocked';
  }

  /**
   * 记录信任反馈（每次人工审核后调用）
   */
  learnFromApproval(operationKey: string, approved: boolean, verified?: boolean): void {
    this.loadTrustMatrix();

    const record = this.trustMatrix.get(operationKey) || {
      operationKey,
      approvalCount: 0,
      rejectionCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0.5,
      lastUpdated: Date.now(),
    };

    if (approved) {
      record.approvalCount++;
      if (verified === true) record.successCount++;
      else if (verified === false) record.failureCount++;
    } else {
      record.rejectionCount++;
    }

    const totalExecutions = record.successCount + record.failureCount;
    record.successRate = totalExecutions > 0 ? record.successCount / totalExecutions : 0.5;
    record.lastUpdated = Date.now();

    this.trustMatrix.set(operationKey, record);
    this.persistTrustRecord(operationKey, record);
  }

  /** 构建操作指纹（用于信任匹配） */
  buildOperationKey(remediation: RemediationPlan): string {
    // 取所有命令的 base command（去掉参数）
    const commandBases = remediation.commands
      .map(c => c.command.trim().split(/\s+/)[0])
      .sort()
      .join('|');
    return `op:${commandBases}`;
  }

  /** 构建操作指纹（从命令字符串） */
  buildOperationKeyFromCommands(commands: string[]): string {
    const bases = commands.map(c => c.trim().split(/\s+/)[0]).sort().join('|');
    return `op:${bases}`;
  }

  /**
   * 判断是否为破坏性操作
   */
  private isDestructiveOperation(remediation: RemediationPlan): boolean {
    for (const cmd of remediation.commands) {
      for (const pattern of DESTRUCTIVE_PATTERNS) {
        if (pattern.test(cmd.command)) return true;
      }
    }
    return false;
  }

  /** 持久化信任记录 */
  private persistTrustRecord(key: string, record: TrustRecord): void {
    automataTrustRepo.upsert(key, {
      approvalCount: record.approvalCount,
      rejectionCount: record.rejectionCount,
      successCount: record.successCount,
      failureCount: record.failureCount,
      successRate: record.successRate,
    });
  }

  /** 获取信任统计 */
  getTrustStats(): { totalOperations: number; highTrust: number; lowTrust: number } {
    this.loadTrustMatrix();
    let high = 0, low = 0;
    for (const record of this.trustMatrix.values()) {
      if (record.approvalCount >= 10 && record.successRate > 0.9) high++;
      if (record.rejectionCount >= 5 || record.successRate < 0.5) low++;
    }
    return {
      totalOperations: this.trustMatrix.size,
      highTrust: high,
      lowTrust: low,
    };
  }
}

export const adaptiveAutomationEngine = new AdaptiveAutomationEngine();
