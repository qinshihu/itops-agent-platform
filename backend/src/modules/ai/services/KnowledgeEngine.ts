/**
 * =============================================================================
 * 统一知识引擎 (KnowledgeEngine)
 *
 * 合并 AARS 的 knowledgeFeedbackLoop 和工作流的 knowledge 节点，
 * 提供统一的知识存储、检索、去重和推荐能力。
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { knowledgeRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import type { KnowledgeRecord } from '../../../repositories';

// ── 类型定义 ──

export interface KnowledgeSolutions {
  rootCause?: string;
  commands?: string[];
  rollbackCommands?: string[];
  verificationResult?: string;
  success?: boolean;
  [key: string]: unknown;
}

export interface KnowledgeEntry {
  id?: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  solutions?: KnowledgeSolutions;
  source: 'aars' | 'workflow' | 'manual';
  alertId?: string;
  workflowId?: string;
  taskId?: string;
  serverId?: string;
  successRating: number; // 0~1
  durationMs?: number;
  usageCount?: number;
  createdAt?: string;
}

export interface KnowledgeQuery {
  keywords?: string[];
  category?: string;
  source?: string;
  serverId?: string;
  alertSeverity?: string;
  limit?: number;
  minSuccessRating?: number;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  similarity: number;
  matchReason: string;
}

export interface KnowledgeStats {
  totalEntries: number;
  totalUsage: number;
  avgSuccessRating: number;
  byCategory: Record<string, number>;
  topKeywords: string[];
}

interface NodeResultData {
  output?: string;
  error?: string;
  status: string;
}

// ── 主类 ──

class KnowledgeEngine {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('📚 KnowledgeEngine 统一知识引擎已启动');
  }

  // ── 存储 ──

  /**
   * 存储一条知识（自动去重）
   * 返回存储后的条目ID
   */
  store(entry: KnowledgeEntry): string {
    const duplicateId = this.findDuplicate(entry);

    if (duplicateId) {
      // 更新已有条目
      knowledgeRepository.mergeOnDuplicate(
        duplicateId,
        entry.content,
        entry.successRating,
        entry.durationMs || null
      );
      logger.info(`📚 知识已合并到已有条目: ${duplicateId}`);
      return duplicateId;
    }

    // 写入新条目
    const id = entry.id || randomUUID();
    const parsedTags = entry.tags ? (typeof entry.tags === 'string' ? entry.tags : JSON.stringify(entry.tags)) : null;
    const parsedSolutions = entry.solutions ? JSON.stringify(entry.solutions) : null;

    knowledgeRepository.create({
      id,
      title: entry.title,
      category: entry.category,
      content: entry.content,
      tags: parsedTags,
      solutions: parsedSolutions,
      source: entry.source,
      alert_id: entry.alertId || null,
      workflow_id: entry.workflowId || null,
      task_id: entry.taskId || null,
      server_id: entry.serverId || null,
      success_rating: entry.successRating,
      duration_ms: entry.durationMs || null,
    });

    logger.info(`📚 新知识已写入: ${id} - ${entry.title.substring(0, 60)}`);
    return id;
  }

  /**
   * 从工作流执行上下文存储知识
   */
  storeFromWorkflow(params: {
    workflowName: string;
    taskId: string;
    workflowId: string;
    alertId?: string;
    nodeResults: Record<string, NodeResultData>;
    overallSuccess: boolean;
    durationMs?: number;
  }): string {
    const parts: string[] = [];
    parts.push(`# ${params.workflowName} - 执行记录\n`);

    for (const [_nodeId, result] of Object.entries(params.nodeResults)) {
      if (result.output) {
        parts.push(`## 节点输出\n${result.output.substring(0, 500)}\n`);
      }
      if (result.error) {
        parts.push(`## 错误\n${result.error}\n`);
      }
    }
    parts.push(`\n**任务ID**: ${params.taskId}`);
    parts.push(`**生成时间**: ${new Date().toISOString()}`);

    const content = parts.join('\n');
    const successRating = params.overallSuccess ? 1.0 : 0.3;

    return this.store({
      title: params.workflowName,
      category: 'workflow_execution',
      content,
      source: 'workflow',
      workflowId: params.workflowId,
      taskId: params.taskId,
      alertId: params.alertId,
      successRating,
      durationMs: params.durationMs,
    });
  }

  /**
   * 从 AARS 处理上下文存储知识
   */
  storeFromAARS(params: {
    alertId: string;
    alertTitle: string;
    alertSource: string;
    alertSeverity: string;
    deviceHostname?: string;
    deviceIp?: string;
    deviceType?: string;
    rootCause: string;
    commands: string[];
    rollbackCommands: string[];
    verificationResult: string;
    overallSuccess: boolean;
    durationMs: number;
  }): string {
    const content = [
      `## 故障案例: ${params.alertTitle}`,
      ``,
      `**告警来源**: ${params.alertSource}`,
      `**告警等级**: ${params.alertSeverity}`,
      `**设备**: ${params.deviceHostname || 'N/A'} (${params.deviceIp || '未知IP'})`,
      `**设备类型**: ${params.deviceType || 'unknown'}`,
      `**根因**: ${params.rootCause}`,
      ``,
      `**修复命令**:`,
      ...params.commands.map(c => `- \`${c}\``),
      ``,
      `**回滚命令**:`,
      ...(params.rollbackCommands.length > 0
        ? params.rollbackCommands.map(c => `- \`${c}\``)
        : ['（无）']),
      ``,
      `**验证结果**: ${params.verificationResult}`,
      `**处理时长**: ${(params.durationMs / 1000).toFixed(1)}s`,
      `**处理结果**: ${params.overallSuccess ? '✅ 成功' : '❌ 失败'}`,
    ].join('\n');

    const tags = ['auto_remediation', 'aars', params.deviceType || 'unknown', params.alertSource].filter(Boolean) as string[];

    return this.store({
      title: `AARS: ${params.alertTitle.substring(0, 200)}`,
      category: 'auto_remediation',
      content,
      tags,
      solutions: {
        rootCause: params.rootCause,
        commands: params.commands,
        rollbackCommands: params.rollbackCommands,
        verificationResult: params.verificationResult,
        success: params.overallSuccess,
      },
      source: 'aars',
      alertId: params.alertId,
      successRating: params.overallSuccess ? 1.0 : 0.3,
      durationMs: params.durationMs,
    });
  }

  // ── 检索 ──

  /**
   * 按关键词检索知识
   */
  query(params: KnowledgeQuery): KnowledgeEntry[] {
    const rows = knowledgeRepository.query({
      category: params.category,
      source: params.source,
      serverId: params.serverId,
      minSuccessRating: params.minSuccessRating,
      limit: params.limit,
    });

    return rows.map(r => this.recordToEntry(r));
  }

  /**
   * 按关键词模糊搜索（标题 + 内容）
   */
  search(keyword: string, limit = 10): KnowledgeEntry[] {
    const rows = knowledgeRepository.search(keyword, limit);
    return rows.map(r => this.recordToEntry(r));
  }

  /**
   * 智能推荐：根据告警信息查找最匹配的历史案例
   * 返回按相似度排序的匹配列表
   */
  recommend(alertTitle: string, alertContent?: string, limit = 5): KnowledgeMatch[] {
    const titleWords = this.tokenize(alertTitle);
    if (titleWords.length === 0) return [];

    // 先用标题关键词快速筛选候选集
    const candidates: KnowledgeEntry[] = [];
    for (const word of titleWords.slice(0, 3)) {
      const partial = this.search(word, 20);
      for (const entry of partial) {
        if (!candidates.find(c => c.id === entry.id)) {
          candidates.push(entry);
        }
      }
    }

    if (candidates.length === 0) {
      // 回退：查同分类最近成功的
      return this.query({ minSuccessRating: 0.7, limit }).map(entry => ({
        entry,
        similarity: 0.3,
        matchReason: '默认推荐（同类成功案例）',
      }));
    }

    // 计算相似度
    const matches: KnowledgeMatch[] = candidates.map(entry => {
      const similarity = this.computeSimilarity(titleWords, entry.title, entry.content);
      return { entry, similarity, matchReason: '' };
    });

    // 排序
    matches.sort((a, b) => b.similarity - a.similarity);

    // 生成匹配原因
    const top = matches.slice(0, limit);
    for (const m of top) {
      if (m.similarity >= 0.7) {
        m.matchReason = `标题高度相似 (${(m.similarity * 100).toFixed(0)}%)`;
      } else if (m.similarity >= 0.4) {
        m.matchReason = `关键词部分匹配 (${(m.similarity * 100).toFixed(0)}%)`;
      } else {
        m.matchReason = '同类案例参考';
      }
    }

    return top;
  }

  /**
   * 按 alertId 查找关联知识
   */
  getByAlertId(alertId: string): KnowledgeEntry | null {
    const row = knowledgeRepository.findByAlertId(alertId);
    return row ? this.recordToEntry(row) : null;
  }

  /**
   * 按 workflowId 查找关联知识
   */
  getByWorkflowId(workflowId: string): KnowledgeEntry[] {
    const rows = knowledgeRepository.findByWorkflowId(workflowId);
    return rows.map(r => this.recordToEntry(r));
  }

  // ── 统计 ──

  /**
   * 获取知识库统计信息
   */
  getStats(): KnowledgeStats {
    try {
      const total = knowledgeRepository.countAll();
      const usage = knowledgeRepository.sumUsageCount();
      const avgRating = knowledgeRepository.avgSuccessRating();

      const byCategory: Record<string, number> = {};
      const catRows = knowledgeRepository.countByCategory();
      for (const r of catRows) {
        byCategory[r.category] = r.count;
      }

      return {
        totalEntries: total,
        totalUsage: usage,
        avgSuccessRating: avgRating,
        byCategory,
        topKeywords: [],
      };
    } catch {
      return { totalEntries: 0, totalUsage: 0, avgSuccessRating: 0, byCategory: {}, topKeywords: [] };
    }
  }

  // ── 辅助方法 ──

  private findDuplicate(entry: KnowledgeEntry): string | null {
    if (!entry.title) return null;

    // 基于标题前缀匹配
    const titlePrefix = entry.title.substring(0, 50).replace(/[%_]/g, '');

    const existing = knowledgeRepository.findDuplicates(titlePrefix, entry.alertId || '');

    for (const row of existing) {
      // 标题相似度 > 0.6 视为重复
      const sim = this.computeSimilarity(this.tokenize(entry.title), row.title, row.content || '');
      if (sim > 0.6) {
        return row.id;
      }
    }

    return null;
  }

  private computeSimilarity(queryWords: string[], title: string, content: string): number {
    const targetWords = this.tokenize(title + ' ' + (content || '').substring(0, 500));

    if (queryWords.length === 0 || targetWords.length === 0) return 0;

    const querySet = new Set(queryWords);
    const targetSet = new Set(targetWords);

    let intersection = 0;
    for (const w of querySet) {
      if (targetSet.has(w)) intersection++;
    }

    const union = new Set([...querySet, ...targetSet]);
    const jaccard = union.size === 0 ? 1 : intersection / union.size;

    // 标题命中加权
    const titleLower = title.toLowerCase();
    let titleBonus = 0;
    for (const w of queryWords) {
      if (titleLower.includes(w)) titleBonus += 0.15;
    }
    titleBonus = Math.min(titleBonus, 0.3);

    return Math.min(1.0, jaccard + titleBonus);
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
      .filter(w => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'from', 'this', 'that', 'with', 'will'].includes(w));
  }

  private recordToEntry(row: KnowledgeRecord): KnowledgeEntry {
    let tags: string[] = [];
    try {
      tags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) as string[] : [];
    } catch { /* ignore */ }

    let solutions: KnowledgeSolutions = {};
    try {
      solutions = row.solutions ? (typeof row.solutions === 'string' ? JSON.parse(row.solutions) : row.solutions) as KnowledgeSolutions : {};
    } catch { /* ignore */ }

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      content: row.content || '',
      tags,
      solutions,
      source: (row.source as KnowledgeEntry['source']) || 'manual',
      alertId: row.alert_id || undefined,
      workflowId: row.workflow_id || undefined,
      taskId: row.task_id || undefined,
      serverId: row.server_id || undefined,
      successRating: row.success_rating || 0.5,
      durationMs: row.duration_ms || undefined,
      usageCount: row.usage_count || 1,
      createdAt: row.created_at,
    };
  }
}

export const knowledgeEngine = new KnowledgeEngine();