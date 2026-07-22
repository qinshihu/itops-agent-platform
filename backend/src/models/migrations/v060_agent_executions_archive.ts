/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v060 — agent_executions 归档 + 复合索引优化
 *
 * 背景：
 *   - v001 已有 idx_agent_executions_created_at（v4 报告 P2-10 误以为缺失，实际已存在）
 *   - 本 migration 真正解决：
 *     1) 复合索引：status + created_at（监控 + 列表查询）
 *     2) agent_id + status（按 agent 状态过滤）
 *     3) 异步归档钩子（agent_executions_archive 表，由 service 层迁移）
 *
 * 归档规则（service 层实现，本 migration 只建表）：
 *   - 默认保留 90 天
 *   - 超过 90 天的 completed/failed 状态自动迁移到 archive 表
 */
const v060AgentExecutionsArchive: Migration = {
  id: '20250101000060',
  version: 60,
  name: 'agent_executions_archive',
  description: '复合索引 (status, created_at) / (agent_id, status) + 归档表',

  up: async (db: any) => {
    logger.info('🔄 Adding archive table and composite indexes for agent_executions...');

    // 1) 归档表（结构与原表一致，无 FK；保留历史数据）
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions_archive (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        input_text TEXT,
        output_text TEXT,
        status TEXT,
        error_message TEXT,
        execution_time_ms INTEGER,
        token_count INTEGER,
        metadata TEXT,
        created_at DATETIME,
        archived_at DATETIME DEFAULT (datetime('now','localtime'))
      );
    `);

    // 2) 归档表索引（按 agent_id + archived_at 查询）
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_executions_archive_agent_id ON agent_executions_archive(agent_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_executions_archive_archived_at ON agent_executions_archive(archived_at);`);

    // 3) 原表复合索引（v4 报告提到的"大字段无索引"实际已存在 created_at 单字段索引；补复合索引）
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_executions_status_created ON agent_executions(status, created_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_status ON agent_executions(agent_id, status);`);

    logger.info('✅ agent_executions archive schema + composite indexes added');
  },

  down: async (db: any) => {
    db.exec(`DROP INDEX IF EXISTS idx_agent_executions_status_created;`);
    db.exec(`DROP INDEX IF EXISTS idx_agent_executions_agent_status;`);
    db.exec(`DROP INDEX IF EXISTS idx_agent_executions_archive_agent_id;`);
    db.exec(`DROP INDEX IF EXISTS idx_agent_executions_archive_archived_at;`);
    db.exec(`DROP TABLE IF EXISTS agent_executions_archive;`);
  },
};

export default v060AgentExecutionsArchive;
