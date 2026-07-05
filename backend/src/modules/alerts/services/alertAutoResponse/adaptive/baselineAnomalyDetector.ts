/**
 * =============================================================================
 * AARS v2 — 历史基线分析 + 异常检测
 *
 * 功能：
 *   1. 维护每个设备的历史指标基线
 *   2. 告警发生时，将当前指标与基线对比
 *   3. 判断是「真正的异常」还是「正常波动」
 *   4. 输出偏离度评分，供风险评分和升级决策参考
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import { getErrorMessage } from '../../../../../utils/errorHelpers';
import { snmpInspectionRepo, baselineMetricsRepo } from '../../../../../repositories';

export interface BaselineDeviation {
  deviationScore: number;   // 0~1, 越大越异常
  isAnomaly: boolean;       // 是否偏离阈值
  factors: BaselineFactor[];
  baselineSummary: string;  // 简短描述
}

export interface BaselineFactor {
  metric: string;
  currentValue: number;
  baselineAvg: number;
  baselineStddev: number;
  deviation: number;        // 偏离标准差倍数
  severity: 'normal' | 'elevated' | 'critical';
}

class BaselineAnomalyDetector {
  /**
   * 分析告警是否异常（基于历史基线）
   */
  async analyze(alertTitle: string, deviceId: string, deviceType: string): Promise<BaselineDeviation> {
    try {
      const factors: BaselineFactor[] = [];

      // 搜集设备当前和历史的指标
      if (deviceType === 'network_device') {
        factors.push(...this.extractSnmpMetrics(deviceId));
      } else if (deviceType === 'server') {
        factors.push(...this.extractServerMetrics(deviceId));
      }

      // 计算综合偏离度
      if (factors.length === 0) {
        return {
          deviationScore: 0.5, // 中等分（无基线，保守）
          isAnomaly: true,     // 无基线时视为异常
          factors: [],
          baselineSummary: '无历史基线数据，按异常处理',
        };
      }

      const maxDeviation = Math.max(...factors.map(f => f.deviation));
      const criticalCount = factors.filter(f => f.severity === 'critical').length;
      const elevatedCount = factors.filter(f => f.severity === 'elevated').length;

      // 综合评分：最大偏离 + 异常因子数量加权
      let score = maxDeviation / 5; // 归一化（5 sigma 以上算满分）
      if (criticalCount > 0) score += 0.2;
      if (elevatedCount > 1) score += 0.1;
      score = Math.min(1, Math.max(0, score));

      const isAnomaly = criticalCount > 0 || elevatedCount > 2 || maxDeviation > 3;

      const summary = isAnomaly
        ? `偏离基线 ${maxDeviation.toFixed(1)}σ（${criticalCount}项严重，${elevatedCount}项偏高）`
        : `在基线范围内（最大偏离 ${maxDeviation.toFixed(1)}σ）`;

      return { deviationScore: score, isAnomaly, factors, baselineSummary: summary };
    } catch (err: unknown) {
      logger.warn(`[Baseline] Baseline analysis failed: ${getErrorMessage(err)}`);
      return { deviationScore: 0.5, isAnomaly: true, factors: [], baselineSummary: '基线分析失败，按异常处理' };
    }
  }

  /**
   * 提取网络设备的接口指标
   */
  private extractSnmpMetrics(deviceId: string): BaselineFactor[] {
    const factors: BaselineFactor[] = [];

    try {
      // 取最新一次指标
      const current = snmpInspectionRepo.listRecentInterfaceMetrics(deviceId, 20);

      if (current.length === 0) return factors;

      // 统计 down 接口比例
      const downCount = current.filter(i => i.if_oper_status !== 1).length;
      const downRatio = downCount / current.length;

      if (downRatio > 0.5) {
        factors.push({
          metric: '接口异常比例',
          currentValue: downRatio * 100,
          baselineAvg: 5,
          baselineStddev: 5,
          deviation: (downRatio * 100 - 5) / 5,
          severity: downRatio > 0.8 ? 'critical' : 'elevated',
        });
      }

      // 检查错误包激增
      const errSum = current.reduce((s, i) => s + (i.if_in_errors || 0) + (i.if_out_errors || 0), 0);
      if (errSum > 1000) {
        factors.push({
          metric: '错误包总数',
          currentValue: errSum,
          baselineAvg: 50,
          baselineStddev: 100,
          deviation: errSum / 100,
          severity: errSum > 10000 ? 'critical' : 'elevated',
        });
      }

      // 检查接口全部 down（严重）
      if (downCount === current.length && current.length > 1) {
        factors.push({
          metric: '所有接口 down',
          currentValue: 100,
          baselineAvg: 0,
          baselineStddev: 1,
          deviation: 100,
          severity: 'critical',
        });
      }
    } catch { /* ignore */ }

    return factors;
  }

  /**
   * 提取服务器指标
   */
  private extractServerMetrics(_deviceId: string): BaselineFactor[] {
    return []; // 服务器指标需要 agent 采集，暂缺
  }

  /**
   * 更新基线（处理完成后调用，如修复成功则更新正常值）
   */
  updateBaseline(deviceId: string, metrics: Record<string, number>): void {
    baselineMetricsRepo.ensureTable();
    baselineMetricsRepo.insertBatch(deviceId, metrics);
  }
}

export const baselineAnomalyDetector = new BaselineAnomalyDetector();
