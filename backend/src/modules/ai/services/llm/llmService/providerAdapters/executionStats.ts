/**
 * providerAdapters 执行记录与统计子模块（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L195-228 的 2 个统计函数抽出：
 * - recordAgentExecution: 写 agent_executions 库
 * - updateAgentStats: 递增 agent 使用次数
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../../../utils/logger';
import { agentExecutionRepository, agentRepository } from '../../../../../../repositories';
import type { AgentExecutionMetadata } from './types';

/** 记录一次 Agent 执行（含 input/output/status/executionTimeMs 等） */
export function recordAgentExecution(
  agentId: string,
  agentName: string,
  inputText: string,
  outputText: string,
  status: 'success' | 'failure',
  errorMessage?: string,
  executionTimeMs?: number,
  metadata?: AgentExecutionMetadata,
): void {
  try {
    agentExecutionRepository.create({
      id: randomUUID(),
      agentId,
      agentName,
      inputText,
      outputText,
      status,
      errorMessage: errorMessage || null,
      executionTimeMs: executionTimeMs ?? null,
      metadata: metadata ?? null,
    });
  } catch (error) {
    logger.error('Failed to record agent execution:', error);
  }
}

/** 递增 Agent 的使用统计（usage_count + last_used_at） */
export function updateAgentStats(agentId: string): void {
  try {
    agentRepository.incrementUsageStats(agentId);
  } catch (error) {
    logger.error('Failed to update agent stats:', error);
  }
}
