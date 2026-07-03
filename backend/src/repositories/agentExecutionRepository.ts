/**
 * agentExecutionRepository — agent_executions 表的统一数据访问层
 *
 * 取代 multiAgentRoutes / agentRoutes / dashboardRoutes 中散落的 INSERT/SELECT。
 * 注意：llmService.ts 内部的 recordAgentExecution() 暂时保留（深层重构，后续迁移）。
 */

import db from '../models/database';

export type AgentExecutionStatus = 'success' | 'failure' | 'error' | 'running' | string;

/** agent_executions 表原始行 */
export interface AgentExecutionRecord {
  id: string;
  agent_id: string;
  agent_name: string;
  input_text: string;
  output_text: string;
  status: string;
  error_message: string | null;
  execution_time_ms: number | null;
  metadata: string | null;
  created_at: string;
  [key: string]: unknown;
}

/** 创建执行记录的输入 */
export interface AgentExecutionCreateInput {
  id: string;
  agentId: string;
  agentName: string;
  inputText: string;
  outputText: string;
  status: AgentExecutionStatus;
  errorMessage?: string | null;
  executionTimeMs?: number | null;
  metadata?: Record<string, unknown> | string | null;
}

export const agentExecutionRepository = {
  /**
   * 创建 Agent 执行记录
   */
  create(input: AgentExecutionCreateInput): void {
    const metadataStr = typeof input.metadata === 'string'
      ? input.metadata
      : (input.metadata ? JSON.stringify(input.metadata) : null);

    db.prepare(`
      INSERT INTO agent_executions (id, agent_id, agent_name, input_text, output_text, status, error_message, execution_time_ms, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id,
      input.agentId,
      input.agentName,
      input.inputText,
      input.outputText,
      input.status,
      input.errorMessage || null,
      input.executionTimeMs ?? null,
      metadataStr
    );
  },

  /**
   * 按 ID 查询执行记录
   */
  getById(id: string): AgentExecutionRecord | undefined {
    return db.prepare('SELECT * FROM agent_executions WHERE id = ?').get(id) as AgentExecutionRecord | undefined;
  },

  /**
   * 按 agent_id 分页查询执行记录（支持 status 过滤）
   */
  listByAgent(
    agentId: string,
    options: { status?: string; limit?: number; offset?: number } = {}
  ): AgentExecutionRecord[] {
    const { status, limit = 20, offset = 0 } = options;

    let query = 'SELECT * FROM agent_executions WHERE agent_id = ?';
    const params: unknown[] = [agentId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params) as AgentExecutionRecord[];
  },

  /**
   * 按 agent_id 统计执行记录数（支持 status 过滤）
   */
  countByAgent(agentId: string, status?: string): number {
    let query = 'SELECT COUNT(*) as count FROM agent_executions WHERE agent_id = ?';
    const params: unknown[] = [agentId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    return (db.prepare(query).get(...params) as { count: number }).count;
  },

  /**
   * 统计全表执行记录数
   */
  countAll(): number {
    return (db.prepare('SELECT COUNT(*) as count FROM agent_executions').get() as { count: number }).count;
  },

  /**
   * 更新执行状态
   */
  updateStatus(id: string, status: AgentExecutionStatus, errorMessage?: string | null): void {
    if (errorMessage !== undefined) {
      db.prepare(`UPDATE agent_executions SET status = ?, error_message = ? WHERE id = ?`).run(status, errorMessage, id);
    } else {
      db.prepare(`UPDATE agent_executions SET status = ? WHERE id = ?`).run(status, id);
    }
  },
};
