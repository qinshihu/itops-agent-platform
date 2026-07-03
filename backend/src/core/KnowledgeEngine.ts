/**
 * =============================================================================
 * 统一知识引擎 (KnowledgeEngine)
 *
 * 合并 AARS 的 knowledgeFeedbackLoop 和工作流的 knowledge 节点，
 * 提供统一的知识存储、检索、去重和推荐能力。
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';

// ── 类型定义 ──

export interface KnowledgeEntry {
  id?: string;
  title: string;
  category: string;
  content: string;
  tags?: string[];
  solutions?: Record<string, unknown>;
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
      db.prepare(`
        UPDATE knowledge_base
        SET content = ?, success_rating = ?, duration_ms = ?, usage_count = COALESCE(usage_count, 0) + 1,
            updated_at = datetime('now','localtime')
        WHERE id = ?
      `).run(
        entry.content,
        entry.successRating,
        entry.durationMs || null,
        duplicateId
      );
      logger.info(`📚 知识已合并到已有条目: ${duplicateId}`);
      return duplicateId;
    }

    // 写入新条目
    const id = entry.id || randomUUID();
    const parsedTags = entry.tags ? (typeof entry.tags === 'string' ? entry.tags : JSON.stringify(entry.tags)) : null;
    const parsedSolutions = entry.solutions ? JSON.stringify(entry.solutions) : null;

    db.prepare(`
      INSERT INTO knowledge_base (id, title, category, content, tags, solutions, source, alert_id, workflow_id, task_id, server_id, success_rating, duration_ms, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      id, entry.title, entry.category, entry.content,
      parsedTags, parsedSolutions,
      entry.source, entry.alertId || null, entry.workflowId || null,
      entry.taskId || null, entry.serverId || null,
      entry.successRating, entry.durationMs || null
    );

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
    nodeResults: Record<string, { output?: string; error?: string; status: string; metadata?: Record<string, unknown> }>;
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
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.category) {
      conditions.push('category = ?');
      values.push(params.category);
    }
    if (params.source) {
      conditions.push('source = ?');
      values.push(params.source);
    }
    if (params.serverId) {
      conditions.push('server_id = ?');
      values.push(params.serverId);
    }
    if (params.minSuccessRating !== undefined) {
      conditions.push('success_rating >= ?');
      values.push(params.minSuccessRating);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = params.limit || 20;

    const rows = db.prepare(`
      SELECT * FROM knowledge_base ${where} ORDER BY usage_count DESC, created_at DESC LIMIT ${limit}
    `).all(...values) as Array<Record<string, unknown>>;

    return rows.map(r => this.rowToEntry(r));
  }

  /**
   * 按关键词模糊搜索（标题 + 内容）
   */
  search(keyword: string, limit = 10): KnowledgeEntry[] {
    const likePattern = `%${keyword}%`;
    const rows = db.prepare(`
      SELECT * FROM knowledge_base
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY usage_count DESC, created_at DESC
      LIMIT ?
    `).all(likePattern, likePattern, limit) as Array<Record<string, unknown>>;

    return rows.map(r => this.rowToEntry(r));
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
    const row = db.prepare('SELECT * FROM knowledge_base WHERE alert_id = ? LIMIT 1').get(alertId) as Record<string, unknown> | undefined;
    return row ? this.rowToEntry(row) : null;
  }

  /**
   * 按 workflowId 查找关联知识
   */
  getByWorkflowId(workflowId: string): KnowledgeEntry[] {
    const rows = db.prepare('SELECT * FROM knowledge_base WHERE workflow_id = ? ORDER BY created_at DESC').all(workflowId) as Array<Record<string, unknown>>;
    return rows.map(r => this.rowToEntry(r));
  }

  // ── 统计 ──

  /**
   * 获取知识库统计信息
   */
  getStats(): KnowledgeStats {
    try {
      const total = (db.prepare('SELECT COUNT(*) as c FROM knowledge_base').get() as { c: number }).c;
      const usage = (db.prepare('SELECT COALESCE(SUM(usage_count), 0) as c FROM knowledge_base').get() as { c: number }).c;
      const avgRating = (db.prepare('SELECT COALESCE(AVG(success_rating), 0) as c FROM knowledge_base').get() as { c: number }).c;

      const byCategory: Record<string, number> = {};
      const catRows = db.prepare('SELECT category, COUNT(*) as c FROM knowledge_base GROUP BY category').all() as Array<{ category: string; c: number }>;
      for (const r of catRows) {
        byCategory[r.category] = r.c;
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
    const titlePrefix = entry.title.substring(0, 50);
    const likePattern = `%${titlePrefix.replace(/[%_]/g, '')}%`;

    const existing = db.prepare(`
      SELECT id, title, content FROM knowledge_base
      WHERE (title LIKE ? OR alert_id = ?)
      ORDER BY created_at DESC LIMIT 5
    `).all(likePattern, entry.alertId || '') as Array<{ id: string; title: string; content: string }>;

    for (const row of existing) {
      // 标题相似度 > 0.6 视为重复
      const sim = this.computeSimilarity(this.tokenize(entry.title), row.title, row.content);
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

  private rowToEntry(row: Record<string, unknown>): KnowledgeEntry {
    let tags: string[] = [];
    try {
      tags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags as string) : row.tags) as string[] : [];
    } catch { /* ignore */ }

    let solutions: Record<string, unknown> = {};
    try {
      solutions = row.solutions ? (typeof row.solutions === 'string' ? JSON.parse(row.solutions as string) : row.solutions) as Record<string, unknown> : {};
    } catch { /* ignore */ }

    return {
      id: row.id as string,
      title: row.title as string,
      category: row.category as string,
      content: row.content as string,
      tags,
      solutions,
      source: (row.source as KnowledgeEntry['source']) || 'manual',
      alertId: row.alert_id as string | undefined,
      workflowId: row.workflow_id as string | undefined,
      taskId: row.task_id as string | undefined,
      serverId: row.server_id as string | undefined,
      successRating: (row.success_rating as number) || 0.5,
      durationMs: row.duration_ms as number | undefined,
      usageCount: (row.usage_count as number) || 1,
      createdAt: row.created_at as string,
    };
  }
}

export const knowledgeEngine = new KnowledgeEngine();
