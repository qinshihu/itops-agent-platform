/**
 * knowledgeRepository — knowledge_base 表的统一数据访问层
 *
 * 取代 KnowledgeEngine.ts / knowledgeRoutes.ts / enhancedRAGService.ts /
 *       knowledgeFeedbackLoop.ts / workflowExecutor.ts / remediationActions.ts /
 *       alertAutoAnalyzer.ts / dashboardRoutes.ts 等散落的 db.prepare 调用。
 *
 * knowledge_base 表结构（v001 + v052）：
 *   id, title, category(DEFAULT 'general'), content, tags, solutions,
 *   source(DEFAULT 'manual'), alert_id, workflow_id, task_id, server_id,
 *   success_rating(DEFAULT 0.5), duration_ms, usage_count(DEFAULT 1),
 *   created_at, updated_at
 *   （v001 遗留列 related_alerts 可能存在，仓库方法以防御性方式处理）
 *
 * 注意：tags / solutions / related_alerts 存储为 JSON 字符串，调用方负责序列化/反序列化。
 */

import db from '../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { KnowledgeEntry } from './types/ai';

// ── 类型定义 ──

export interface KnowledgeRecord {
  id: string;
  title: string;
  category: string;
  content?: string | null;
  tags?: string | null;
  solutions?: string | null;
  source?: string | null;
  alert_id?: string | null;
  workflow_id?: string | null;
  task_id?: string | null;
  server_id?: string | null;
  success_rating?: number | null;
  duration_ms?: number | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
  related_alerts?: string | null;
}

/** 列表过滤条件 */
export interface KnowledgeListFilters {
  category?: string;
  search?: string;
}

/** 查询过滤条件（KnowledgeEngine.query 用） */
export interface KnowledgeQueryFilters {
  category?: string;
  source?: string;
  serverId?: string;
  minSuccessRating?: number;
  limit?: number;
}

/** 创建知识条目输入（完整 13 字段） */
export interface KnowledgeCreateInput {
  id: string;
  title: string;
  category: string;
  content?: string | null;
  tags?: string | null;
  solutions?: string | null;
  source?: string | null;
  alert_id?: string | null;
  workflow_id?: string | null;
  task_id?: string | null;
  server_id?: string | null;
  success_rating?: number | null;
  duration_ms?: number | null;
}

/** REST 路由创建输入（含 legacy related_alerts） */
export interface KnowledgeCreateRestInput {
  id: string;
  title: string;
  category?: string | null;
  tags?: string | null;
  content?: string | null;
  solutions?: string | null;
  related_alerts?: string | null;
}

/** REST 路由更新输入 */
export interface KnowledgeUpdateRestInput {
  title: string;
  category?: string | null;
  tags?: string | null;
  content?: string | null;
  solutions?: string | null;
  related_alerts?: string | null;
}

// ── repository 实现 ──

export const knowledgeRepository = {
  // ── SELECT：列表与过滤 ──

  /**
   * 列出知识条目（可选 category + search 过滤）
   * 对应 knowledgeRoutes.ts S1
   */
  list(filters?: KnowledgeListFilters): KnowledgeRecord[] {
    let sql = 'SELECT * FROM knowledge_base';
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.search) {
      conditions.push('(title LIKE ? OR content LIKE ?)');
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY usage_count DESC, created_at DESC';
    return db.prepare(sql).all(...params) as KnowledgeRecord[];
  },

  /**
   * 多条件查询（category/source/serverId/minSuccessRating + limit）
   * 对应 KnowledgeEngine.ts S5
   */
  query(filters?: KnowledgeQueryFilters): KnowledgeRecord[] {
    let sql = 'SELECT * FROM knowledge_base';
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (filters?.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }
    if (filters?.source) {
      conditions.push('source = ?');
      params.push(filters.source);
    }
    if (filters?.serverId) {
      conditions.push('server_id = ?');
      params.push(filters.serverId);
    }
    if (filters?.minSuccessRating !== undefined) {
      conditions.push('success_rating >= ?');
      params.push(filters.minSuccessRating);
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    const limit = filters?.limit ?? 20;
    sql += ` ORDER BY usage_count DESC, created_at DESC LIMIT ${limit}`;
    return db.prepare(sql).all(...params) as KnowledgeRecord[];
  },

  /**
   * 按关键词搜索（title OR content LIKE）
   * 对应 KnowledgeEngine.ts S6 / knowledgeRoutes.ts S7
   */
  search(keyword: string, limit?: number): KnowledgeRecord[] {
    const pattern = `%${keyword}%`;
    if (limit !== undefined) {
      return db.prepare(`
        SELECT * FROM knowledge_base
        WHERE title LIKE ? OR content LIKE ?
        ORDER BY usage_count DESC, created_at DESC LIMIT ?
      `).all(pattern, pattern, limit) as KnowledgeRecord[];
    }
    return db.prepare(`
      SELECT * FROM knowledge_base
      WHERE title LIKE ? OR content LIKE ?
      ORDER BY usage_count DESC
    `).all(pattern, pattern) as KnowledgeRecord[];
  },

  /**
   * 按关键词搜索（排除 operational 类别，返回 title/content/solutions）
   * 对应：analysisEngine.aiAnalyze
   */
  searchForAnalysis(keywords: string, limit = 3): Array<{ title: string; content: string; solutions: string }> {
    const pattern = `%${keywords}%`;
    return db.prepare(`
      SELECT title, content, solutions FROM knowledge_base
      WHERE (content LIKE ? OR title LIKE ?) AND category != 'operational'
      LIMIT ?
    `).all(pattern, pattern, limit) as Array<{ title: string; content: string; solutions: string }>;
  },

  /**
   * RAG 候选集查询（可选 category，LIMIT 50）
   * 对应 enhancedRAGService.ts S9
   */
  findRagCandidates(category?: string): KnowledgeRecord[] {
    if (category) {
      return db.prepare(`
        SELECT * FROM knowledge_base WHERE 1=1 AND category = ?
        ORDER BY usage_count DESC, created_at DESC LIMIT 50
      `).all(category) as KnowledgeRecord[];
    }
    return db.prepare(`
      SELECT * FROM knowledge_base WHERE 1=1
      ORDER BY usage_count DESC, created_at DESC LIMIT 50
    `).all() as KnowledgeRecord[];
  },

  // ── SELECT：单条查询 ──

  /**
   * 按 id 获取完整记录
   * 对应 knowledgeRoutes.ts S2 / enhancedRAGService.ts
   */
  getById(id: string): KnowledgeRecord | undefined {
    return db.prepare('SELECT * FROM knowledge_base WHERE id = ?').get(id) as KnowledgeRecord | undefined;
  },

  /**
   * 按 alert_id 获取（LIMIT 1）
   * 对应 KnowledgeEngine.ts S3
   */
  findByAlertId(alertId: string): KnowledgeRecord | undefined {
    return db.prepare('SELECT * FROM knowledge_base WHERE alert_id = ? LIMIT 1')
      .get(alertId) as KnowledgeRecord | undefined;
  },

  /**
   * 按 workflow_id 获取（按创建时间倒序）
   * 对应 KnowledgeEngine.ts S4
   */
  findByWorkflowId(workflowId: string): KnowledgeRecord[] {
    return db.prepare('SELECT * FROM knowledge_base WHERE workflow_id = ? ORDER BY created_at DESC')
      .all(workflowId) as KnowledgeRecord[];
  },

  /**
   * 查找重复条目（title LIKE 或 alert_id 匹配，LIMIT 5）
   * 对应 KnowledgeEngine.ts S8
   */
  findDuplicates(titlePattern: string, alertId: string): Array<{ id: string; title: string; content: string | null }> {
    return db.prepare(`
      SELECT id, title, content FROM knowledge_base
      WHERE (title LIKE ? OR alert_id = ?)
      ORDER BY created_at DESC LIMIT 5
    `).all(`%${titlePattern}%`, alertId) as Array<{ id: string; title: string; content: string | null }>;
  },

  /**
   * 按标题和分类查重（反馈循环用，LIMIT 1）
   * 对应 knowledgeFeedbackLoop.ts S12
   */
  findIdByTitleAndCategory(titlePattern: string, category: string): string | undefined {
    const row = db.prepare(`
      SELECT id FROM knowledge_base
      WHERE title LIKE ? AND category = ? LIMIT 1
    `).get(`%${titlePattern}%`, category) as { id: string } | undefined;
    return row?.id;
  },

  /**
   * 按 category 获取 id/content（重复检查用，LIMIT 50）
   * 对应 workflowExecutor.ts S10
   */
  findIdContentByCategory(category: string, limit: number): Array<{ id: string; content: string | null }> {
    return db.prepare(`
      SELECT id, content FROM knowledge_base
      WHERE category = ? ORDER BY created_at DESC LIMIT ?
    `).all(category, limit) as Array<{ id: string; content: string | null }>;
  },

  /**
   * 告警分析查询（title/content LIKE，排除 operational 分类，LIMIT 3）
   * 对应 alertAutoAnalyzer.ts S11
   */
  findForAlertAnalysis(keywords: string): Array<{ title: string; content: string | null; solutions: string | null }> {
    const pattern = `%${keywords}%`;
    return db.prepare(`
      SELECT title, content, solutions FROM knowledge_base
      WHERE (content LIKE ? OR title LIKE ?) AND category != 'operational' LIMIT 3
    `).all(pattern, pattern) as Array<{ title: string; content: string | null; solutions: string | null }>;
  },

  // ── SELECT：统计 ──

  /**
   * 统计总数
   * 对应 enhancedRAGService.ts S13e / dashboardRoutes.ts S13f
   */
  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number };
    return row.count;
  },

  /**
   * 统计 usage_count 总和
   * 对应 KnowledgeEngine.ts S13b
   */
  sumUsageCount(): number {
    const row = db.prepare('SELECT COALESCE(SUM(usage_count), 0) as c FROM knowledge_base').get() as { c: number };
    return row.c;
  },

  /**
   * 统计 success_rating 平均值
   * 对应 KnowledgeEngine.ts S13c
   */
  avgSuccessRating(): number {
    const row = db.prepare('SELECT COALESCE(AVG(success_rating), 0) as c FROM knowledge_base').get() as { c: number };
    return row.c;
  },

  /**
   * 按分类统计
   * 对应 KnowledgeEngine.ts S13d / enhancedRAGService.ts S14
   */
  countByCategory(): Array<{ category: string; count: number }> {
    return db.prepare(`
      SELECT category, COUNT(*) as count
      FROM knowledge_base GROUP BY category ORDER BY count DESC
    `).all() as Array<{ category: string; count: number }>;
  },

  /**
   * 获取使用次数最高的条目
   * 对应 enhancedRAGService.ts S15
   */
  findTopItems(limit: number): KnowledgeRecord[] {
    return db.prepare(`
      SELECT * FROM knowledge_base
      ORDER BY usage_count DESC, created_at DESC LIMIT ?
    `).all(limit) as KnowledgeRecord[];
  },

  // ── INSERT ──

  /**
   * 创建完整知识条目（16 字段，usage_count=1）
   * 对应 KnowledgeEngine.ts I1
   */
  create(input: KnowledgeCreateInput): void {
    db.prepare(`
      INSERT INTO knowledge_base
      (id, title, category, content, tags, solutions, source, alert_id, workflow_id, task_id, server_id,
       success_rating, duration_ms, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.title,
      input.category,
      input.content ?? null,
      input.tags ?? null,
      input.solutions ?? null,
      input.source ?? null,
      input.alert_id ?? null,
      input.workflow_id ?? null,
      input.task_id ?? null,
      input.server_id ?? null,
      input.success_rating ?? null,
      input.duration_ms ?? null
    );
  },

  /**
   * REST 路由创建（7 字段，含 legacy related_alerts）
   * 对应 knowledgeRoutes.ts I2
   */
  createFromRest(input: KnowledgeCreateRestInput): void {
    db.prepare(`
      INSERT INTO knowledge_base (id, title, category, tags, content, solutions, related_alerts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.title,
      input.category ?? 'general',
      input.tags ?? null,
      input.content ?? null,
      input.solutions ?? null,
      input.related_alerts ?? null
    );
  },

  /**
   * 简化创建（5 字段，失败案例用）
   * 对应 workflowExecutor.ts I4
   */
  createMinimal(input: { id: string; title: string; category: string; content: string }): void {
    db.prepare(`
      INSERT INTO knowledge_base (id, title, category, content, created_at)
      VALUES (?, ?, ?, ?, datetime('now','localtime'))
    `).run(input.id, input.title, input.category, input.content);
  },

  // ── UPDATE ──

  /**
   * 合并到已有条目（content/success_rating/duration_ms + usage_count++）
   * 对应 KnowledgeEngine.ts U1
   */
  mergeOnDuplicate(id: string, content: string, successRating: number, durationMs: number | null): void {
    db.prepare(`
      UPDATE knowledge_base
      SET content = ?, success_rating = ?, duration_ms = ?,
          usage_count = COALESCE(usage_count, 0) + 1,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(content, successRating, durationMs, id);
  },

  /**
   * REST 路由更新（含 legacy related_alerts）
   * 对应 knowledgeRoutes.ts U2
   */
  updateFromRest(id: string, input: KnowledgeUpdateRestInput): number {
    const result = db.prepare(`
      UPDATE knowledge_base
      SET title = ?, category = ?, tags = ?, content = ?,
          solutions = ?, related_alerts = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.title,
      input.category ?? null,
      input.tags ?? null,
      input.content ?? null,
      input.solutions ?? null,
      input.related_alerts ?? null,
      id
    );
    return (result as { changes: number }).changes;
  },

  /**
   * 增加使用次数（usage_count++）
   * 对应 enhancedRAGService.ts U3
   */
  incrementUsageCount(id: string): void {
    db.prepare(`
      UPDATE knowledge_base
      SET usage_count = usage_count + 1, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(id);
  },

  /**
   * 增加使用次数并替换 content（反馈循环用）
   * 对应 knowledgeFeedbackLoop.ts U4
   */
  incrementUsageAndReplaceContent(id: string, content: string): void {
    db.prepare(`
      UPDATE knowledge_base
      SET usage_count = usage_count + 1, content = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(content, id);
  },

  // ── DELETE ──

  /**
   * 按 id 删除
   * 对应 knowledgeRoutes.ts D1
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },
};
