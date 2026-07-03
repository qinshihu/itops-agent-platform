import type { Migration } from './migrationFramework';

/**
 * Migration v052 — knowledge_base 表
 *
 * 从 core/KnowledgeEngine.ensureTable() 下沉而来。
 * 统一知识引擎持久化表 + 索引 + 兼容旧数据的列补齐。
 */
const v052KnowledgeBase: Migration = {
  id: '20250101000052',
  version: 52,
  name: 'knowledge_base',
  description: 'Knowledge engine base table (migrated from KnowledgeEngine.ensureTable)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        content TEXT,
        tags TEXT,
        solutions TEXT,
        source TEXT DEFAULT 'manual',
        alert_id TEXT,
        workflow_id TEXT,
        task_id TEXT,
        server_id TEXT,
        success_rating REAL DEFAULT 0.5,
        duration_ms INTEGER,
        usage_count INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
      CREATE INDEX IF NOT EXISTS idx_kb_source ON knowledge_base(source);
      CREATE INDEX IF NOT EXISTS idx_kb_alert_id ON knowledge_base(alert_id);
      CREATE INDEX IF NOT EXISTS idx_kb_workflow_id ON knowledge_base(workflow_id);
    `);

    // 兼容旧数据的列补齐（幂等）
    const addColumnIfMissing = (col: string, def: string) => {
      try { db.exec(`ALTER TABLE knowledge_base ADD COLUMN ${col} ${def}`); } catch { /* 列已存在 */ }
    };
    addColumnIfMissing('success_rating', 'REAL DEFAULT 0.5');
    addColumnIfMissing('source', "TEXT DEFAULT 'manual'");
    addColumnIfMissing('alert_id', 'TEXT');
    addColumnIfMissing('workflow_id', 'TEXT');
    addColumnIfMissing('task_id', 'TEXT');
    addColumnIfMissing('server_id', 'TEXT');
    addColumnIfMissing('duration_ms', 'INTEGER');
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS knowledge_base`);
  },
};

export default v052KnowledgeBase;
