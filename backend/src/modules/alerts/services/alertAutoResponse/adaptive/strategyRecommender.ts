/**
 * =============================================================================
 * AARS v2 — 诊断策略推荐引擎（多臂老虎机风格自适应推荐）
 *
 * 核心思路（信息论基础）：
 *   1. 每个探针是一个"臂"，历史准确率 = 收益概率
 *   2. 每次推荐用上置信界（UCB1）算法在"探索 vs 利用"之间平衡
 *   3. 信息增益最大化：选择能最多缩小可能根因集合的探针
 *   4. 多臂老虎机（MAB）的 epsilon-greedy 实现
 * =============================================================================
 */

import { logger } from '../../../../../utils/logger';
import { PROBE_CATALOG } from '../probeUnit';
import type { ProbeUnit, DeviceRuntimeProfile } from '../types';
import { getErrorMessage } from '../../../../../utils/errorHelpers';
import { probeStatsRepo } from '../../../../../repositories';

// 探针历史准确率缓存（从知识库/探针日志表加载）
interface ProbeHistory {
  totalUses: number;
  successfulDiagnoses: number;
  successRate: number;  // 0~1
}

class StrategyRecommender {
  private probeHistory = new Map<string, ProbeHistory>();
  private lastLoadTime = 0;
  private readonly LOAD_INTERVAL_MS = 300_000; // 5 分钟刷新一次

  /** 持久化探针使用历史表 */
  private ensureProbeStatsTable(): void {
    probeStatsRepo.ensureTable();
  }

  /** 从数据库加载探针历史 */
  private loadHistory(): void {
    if (Date.now() - this.lastLoadTime < this.LOAD_INTERVAL_MS) return;
    this.lastLoadTime = Date.now();
    try {
      const rows = probeStatsRepo.listAll();

      for (const row of rows) {
        const total = row.total_uses || 1;
        this.probeHistory.set(row.probe_id, {
          totalUses: total,
          successfulDiagnoses: row.successful_diagnoses || 0,
          successRate: (row.successful_diagnoses || 0) / total,
        });
      }
    } catch {
      this.ensureProbeStatsTable();
    }
  }

  /**
   * 主推荐方法 —— UCB1 算法
   *
   * @param alert 告警对象
   * @param device 设备画像
   * @param k 需要返回的探针数
   */
  recommend(alertTitle: string, alertContent: string, device: DeviceRuntimeProfile, k = 5): ProbeUnit[] {
    this.loadHistory();
    this.ensureProbeStatsTable();

    // Step 1: 基础过滤 — OS 兼容
    const candidates = PROBE_CATALOG.filter(p => {
      if (!p.enabled) return false;
      // OS 兼容检查
      if (device.type === 'server') {
        return p.applicableOS.includes('linux') || p.applicableOS.includes('windows');
      }
      if (device.type === 'network_device') {
        return p.applicableOS.includes('network_os') || p.applicableOS.includes('linux');
      }
      return true;
    });

    // Step 2: 告警语义相关性排序（关键词匹配）
    const semanticScores = this.computeSemanticRelevance(candidates, alertTitle, alertContent);

    // Step 3: UCB1 分数计算
    const totalAttempts = Math.max(
      1,
      Array.from(this.probeHistory.values()).reduce((s, h) => s + h.totalUses, 0)
    );

    const scored = semanticScores.map(({ probe, semanticScore }) => {
      const history = this.probeHistory.get(probe.id);
      const uses = history?.totalUses || 0;

      // UCB1: w_j + sqrt(2 * ln(N) / n_j)
      const exploitation = history?.successRate || 0.5;
      const exploration = uses > 0
        ? Math.sqrt(2 * Math.log(totalAttempts) / uses)
        : 0.5; // 未使用过的探针给高探索分

      const ucbScore = exploitation + exploration;

      // 最终分数 = 语义分 * 0.4 + UCB1 * 0.4 + 信息熵权重 * 0.2
      const finalScore = semanticScore * 0.4 + ucbScore * 0.4 + (probe.infoGainWeight || 0.5) * 0.2;

      return { probe, score: finalScore };
    });

    // Step 4: 多样性保证 —— 同类别不取太多
    const selected = this.diversifySelection(scored, k);

    logger.info(
      `[StrategyRecommender] Recommended ${selected.length} probes for alert "${alertTitle.substring(0, 40)}..." ` +
      `selected: ${selected.map(p => p.id).join(', ')}`
    );

    return selected;
  }

  /**
   * 计算探针与告警文本的语义相关性（简单 NLP：关键同现）
   */
  private computeSemanticRelevance(
    probes: ProbeUnit[],
    alertTitle: string,
    alertContent: string
  ): Array<{ probe: ProbeUnit; semanticScore: number }> {
    const text = `${alertTitle} ${alertContent}`.toLowerCase();
    const words = new Set(text.split(/[\s\-_,.:/]+/).filter(w => w.length > 2));

    // 告警类型关键词组
    const cpuKeywords = new Set(['cpu', 'load', 'high', 'utilization', 'usage', '核', '负载']);
    const memKeywords = new Set(['memory', 'mem', 'oom', 'swap', '内存', '耗尽']);
    const diskKeywords = new Set(['disk', 'storage', 'space', 'io', 'inode', '磁盘', '存储']);
    const networkKeywords = new Set(['network', 'interface', 'port', 'link', 'connect', 'timeout', '网络', '接口', '端口']);
    const serviceKeywords = new Set(['service', 'process', 'daemon', 'crash', 'down', '服务', '进程', '宕']);
    const hardwareKeywords = new Set(['temperature', 'temp', 'fan', 'power', 'hardware', '温度', '风扇', '电源']);

    const keywordSets = [cpuKeywords, memKeywords, diskKeywords, networkKeywords, serviceKeywords, hardwareKeywords];
    const matchThreshold = 2; // 至少匹配 N 个词才算真实命中

    return probes.map(probe => {
      const desc = `${probe.name} ${probe.description} ${(probe.commands || []).join(' ')} ${(probe.oids || []).join(' ')}`.toLowerCase();

      // 直接关键词匹配
      let directMatch = 0;
      for (const w of words) {
        if (desc.includes(w)) directMatch += 1;
      }

      // 语义类别匹配
      let categoryMatch = 0;
      for (const kwSet of keywordSets) {
        const matchedWords = [...kwSet].filter(kw => words.has(kw));
        const matchedDesc = [...kwSet].filter(kw => desc.includes(kw));
        if (matchedWords.length >= matchThreshold && matchedDesc.length >= 1) {
          categoryMatch += 2;
        }
      }

      const score = Math.min(1, directMatch * 0.15 + categoryMatch * 0.2);
      return { probe, semanticScore: score };
    });
  }

  /**
   * 多样性选择（防止同类探针扎堆）
   */
  private diversifySelection(
    scored: Array<{ probe: ProbeUnit; score: number }>,
    k: number
  ): ProbeUnit[] {
    // 按分数降序排列
    const sorted = [...scored].sort((a, b) => b.score - a.score);

    const selected: ProbeUnit[] = [];
    const selectedCategories = new Set<string>();

    // 探针类别划分
    function getCategory(probe: ProbeUnit): string {
      if (probe.oids && probe.oids.length > 0) return 'snmp';
      if (probe.id.startsWith('cpu') || probe.id.startsWith('mem') || probe.id.startsWith('disk')) return 'resource';
      if (probe.id.startsWith('journal') || probe.id.startsWith('dmesg') || probe.id.startsWith('log')) return 'log';
      if (probe.id.startsWith('network') || probe.id.startsWith('listening') || probe.id.startsWith('arp')) return 'network';
      if (probe.id.startsWith('docker') || probe.id.startsWith('process')) return 'process';
      return 'general';
    }

    // 第一轮：每类最多一个最高分探针
    for (const { probe, score } of sorted) {
      if (selected.length >= k) break;
      const cat = getCategory(probe);
      if (!selectedCategories.has(cat) || score > 0.8) {
        selected.push(probe);
        selectedCategories.add(cat);
      }
    }

    // 第二轮：填空
    for (const { probe } of sorted) {
      if (selected.length >= k) break;
      if (!selected.includes(probe)) {
        selected.push(probe);
      }
    }

    return selected;
  }

  /**
   * 探针执行成功后记录反馈（更新历史统计数据）
   */
  recordProbeResult(probeId: string, success: boolean, durationMs: number, deviceId?: string, alertType?: string): void {
    try {
      const history = this.probeHistory.get(probeId) || { totalUses: 0, successfulDiagnoses: 0, successRate: 0 };
      history.totalUses += 1;
      if (success) history.successfulDiagnoses += 1;
      history.successRate = history.successfulDiagnoses / history.totalUses;
      this.probeHistory.set(probeId, history);

      // 持久化
      probeStatsRepo.recordResult(probeId, success, durationMs, deviceId, alertType);
    } catch (err: unknown) {
      logger.warn(`Failed to record probe result for ${probeId}: ${getErrorMessage(err)}`);
    }
  }
}

export const strategyRecommender = new StrategyRecommender();
