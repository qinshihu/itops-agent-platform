/**
 * 集成测试数据库基础设施
 *
 * 使用 better-sqlite3 内存数据库，运行全部迁移后提供给测试使用。
 * 不 mock 数据库——使用真实的 SQLite 引擎，确保测试贴近生产行为。
 */

import Database from 'better-sqlite3';
import { createMigrationManager } from '../../models/migrations/index';

let testDbInstance: Database.Database | null = null;

/**
 * 创建内存测试数据库并运行全部迁移。
 * 幂等：若已存在则直接返回已有实例。
 */
export async function createTestDatabase(): Promise<Database.Database> {
  if (testDbInstance) {
    return testDbInstance;
  }

  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  const manager = createMigrationManager(db);

  // 分批运行迁移，在 v052 之前补齐 knowledge_base 缺失列
  // 原因：v001 创建 knowledge_base 时不含 source/alert_id 等列，
  //        v052 在 addColumnIfMissing 之前先 CREATE INDEX ... ON (source) 导致失败
  const result1 = await manager.migrateTo(51);
  if (!result1.success) {
    throw new Error(`Migration v${result1.failedVersion} failed: ${result1.errorMessage}`);
  }

  // 补齐 v052 所需的列（幂等，已存在则跳过）
  const addCol = (col: string, def: string) => {
    try { db.exec(`ALTER TABLE knowledge_base ADD COLUMN ${col} ${def}`); } catch { /* 已存在 */ }
  };
  addCol('source', "TEXT DEFAULT 'manual'");
  addCol('alert_id', 'TEXT');
  addCol('workflow_id', 'TEXT');
  addCol('task_id', 'TEXT');
  addCol('server_id', 'TEXT');
  addCol('success_rating', 'REAL DEFAULT 0.5');
  addCol('duration_ms', 'INTEGER');

  // 运行剩余迁移 (v052–v055)
  const result2 = await manager.migrate();
  if (!result2.success) {
    throw new Error(`Migration v${result2.failedVersion} failed: ${result2.errorMessage}`);
  }

  testDbInstance = db;
  return db;
}

/**
 * 获取已初始化的测试数据库实例。
 * 必须在 createTestDatabase() 之后调用。
 */
export function getTestDb(): Database.Database {
  if (!testDbInstance) {
    throw new Error('Test database not initialized. Call createTestDatabase() first.');
  }
  return testDbInstance;
}

/**
 * 关闭并释放测试数据库。
 */
export function cleanupTestDatabase(): void {
  if (testDbInstance) {
    testDbInstance.close();
    testDbInstance = null;
  }
}
