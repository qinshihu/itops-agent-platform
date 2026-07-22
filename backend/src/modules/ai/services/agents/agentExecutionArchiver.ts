/**
 * agentExecutionArchiver — 定期归档 agent_executions 表
 *
 * 背景：v060 migration 加了 agent_executions_archive 表
 *       本 service 把 >90 天的 completed/failed 记录迁过去
 *
 * 启动：在 serviceRegistry 启动时调用 startAgentExecutionArchive(intervalMs)
 *       默认 24h 一次（生产），dev 模式可缩短
 */
// TODO v2.5 (工单：agentExecutionsRepository 拆分)：该文件是后台定时归档任务，
// 目前直接 import db 做跨表批量操作（INSERT INTO ... SELECT + DELETE）。
// 计划抽到 repositories/agentRepository/agentExecutionsArchiveRepo.ts，让本文件
// 只调用 repo.archiveBefore(cutoffDate)。预计工时 4h（参考 ADR-020 §六 v2.5）。
/* eslint-disable no-restricted-imports -- 临时豁免，等 repository 拆分后撤销 */

import db from '../../../../models/database';
import { logger } from '../../../../utils/logger';

let intervalId: ReturnType<typeof setInterval> | null = null;

const ARCHIVE_RETENTION_DAYS = 90;

interface ArchiveResult {
  archived: number;
  deleted: number;
  durationMs: number;
}

export function archiveAgentExecutions(retentionDays = ARCHIVE_RETENTION_DAYS): ArchiveResult {
  const startMs = Date.now();
  const cutoff = `'${new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()}'`;

  // 1) 复制到归档表
  const insertResult = db.prepare(`
    INSERT INTO agent_executions_archive
      (id, agent_id, agent_name, input_text, output_text, status, error_message,
       execution_time_ms, token_count, metadata, created_at, archived_at)
    SELECT id, agent_id, agent_name, input_text, output_text, status, error_message,
       execution_time_ms, token_count, metadata, created_at, datetime('now','localtime')
    FROM agent_executions
    WHERE status IN ('completed','failed')
      AND created_at < ${cutoff}
  `).run();

  // 2) 删除原表
  const deleteResult = db.prepare(`
    DELETE FROM agent_executions
    WHERE status IN ('completed','failed')
      AND created_at < ${cutoff}
  `).run();

  const durationMs = Date.now() - startMs;
  const result: ArchiveResult = {
    archived: insertResult.changes,
    deleted: deleteResult.changes,
    durationMs,
  };
  if (result.archived > 0) {
    logger.info(`📦 [AgentArchiver] Archived ${result.archived} executions (${result.deleted} deleted) in ${durationMs}ms`);
  } else {
    logger.debug(`📦 [AgentArchiver] No executions to archive`);
  }
  return result;
}

export function startAgentExecutionArchive(intervalMs = 24 * 60 * 60 * 1000) {
  if (intervalId) return;
  logger.info(`📦 Agent execution archiver started (interval: ${intervalMs}ms, retention: ${ARCHIVE_RETENTION_DAYS}d)`);
  // 启动时跑一次（延迟 30s 避开冷启动）
  setTimeout(() => archiveAgentExecutions(), 30_000);
  intervalId = setInterval(() => archiveAgentExecutions(), intervalMs);
  intervalId.unref();
}

export function stopAgentExecutionArchive() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('📦 Agent execution archiver stopped');
  }
}

export const __test = { archiveAgentExecutions };
