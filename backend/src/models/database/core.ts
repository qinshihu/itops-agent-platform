import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';
import { runMigrations } from '../migrations';
import { initializeDefaultData } from './defaultData';
import { startDatabaseMaintenance } from './maintenance';

export { setIOInstance, getIOInstance } from '../../shared/websocket/io';

let dbInstance: Database.Database | null = null;
let isInitialized = false;

function createDatabaseInstance(dbPath: string): Database.Database {
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const database = new Database(dbPath);

  // ==================== WAL 模式优化配置 ====================
  // WAL 模式：写入不阻塞读取，大幅提升并发性能
  database.pragma('journal_mode = WAL');
  
  // WAL 自动检查点：当 WAL 文件达到 16MB 或 4000 页时执行检查点
  // 平衡写入性能和恢复时间
  database.pragma('wal_autocheckpoint = 4000');
  
  // WAL 文件大小限制：最大 256MB，防止无限增长
  database.pragma('journal_size_limit = 268435456');
  
  // ==================== 并发和锁优化 ====================
  // 忙等待超时：10 秒，避免高并发时立即失败
  database.pragma('busy_timeout = 10000');
  
  // 锁定模式：NORMAL 允许多进程共享锁，提升并发读取能力
  database.pragma('locking_mode = NORMAL');
  
  // ==================== 数据完整性配置 ====================
  // 外键约束：保证数据一致性
  database.pragma('foreign_keys = ON');
  
  // 同步模式：FULL 确保断电/崩溃时事务不丢失（生产环境推荐）
  database.pragma('synchronous = FULL');
  
  // 递归触发器：确保级联操作正确执行
  database.pragma('recursive_triggers = ON');
  
  // ==================== 内存和缓存优化 ====================
  // 临时表存储：使用内存提升排序/临时查询性能
  database.pragma('temp_store = MEMORY');
  
  // 内存映射：允许直接内存访问大文件（2GB）
  database.pragma('mmap_size = 2147483648');
  
  // 页面缓存：128MB 缓存，减少磁盘 IO
  database.pragma('cache_size = -128000');
  
  // 缓存溢出：允许缓存溢出到磁盘，避免内存不足
  database.pragma('cache_spill = ON');
  
  // 自动索引：允许自动创建临时索引优化查询
  database.pragma('automatic_index = ON');
  
  // ==================== 查询优化器统计 ====================
  // 启用查询优化器统计信息，生成更优执行计划
  database.pragma('optimizer_statistics = true');

  return database;
}

export function getDbInstance(): Database.Database {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

// Database singleton - single centralized export
// All modules should import via:
//   import { db } from '../models/database';
//   import db from '../models/database';

type DatabaseProxy = Database.Database;

const db: DatabaseProxy = new Proxy({}, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (dbInstance as any)[prop];
  }
}) as DatabaseProxy;

export default db;
export { db };

export async function initializeDatabase(): Promise<void> {
  if (isInitialized && dbInstance) {
    logger.info('Database already initialized, skipping');
    return;
  }

  dbInstance = createDatabaseInstance(env.DATABASE_PATH);
  isInitialized = true;

  // 运行数据库迁移（包含所有表和索引创建）
  await runMigrations(db);

  // Run AI model migration (delayed to avoid circular import)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { migrateOldConfigToAIModels, migrateOldAgents } = await import('../../modules/ai/services/models/aiModelService');
  migrateOldConfigToAIModels();
  migrateOldAgents();

  // 初始化默认数据
  initializeDefaultData();

  logger.info('✅ Database initialized successfully with preset configurations');
  
  startDatabaseMaintenance();
}