import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import { runMigrations } from './migrations';
import { initializePresetAgents } from './presets/initAgents';
import { initializePresetWorkflows } from './presets/initWorkflows';
import { initializePresetReportTemplates } from './presets/initReports';
import { initializePresetKnowledge } from './presets/initKnowledge';
import { initializePresetScripts } from './presets/initScripts';
import { initializeAlertMappings } from './presets/initAlertMappings';
import { initializePresetScheduledTasks } from './presets/initScheduledTasks';
import { initRemediationPolicies } from './presets/initRemediationPolicies';
import { linkRemediationWorkflows } from './presets/linkRemediationWorkflows';
import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

let maintenanceTimer: NodeJS.Timeout | null = null;
let isMaintenanceRunning = false;

export function setIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getIOInstance() {
  return ioInstance;
}

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

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return (dbInstance as any)[prop];
  }
}) as Database.Database;

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
    return (dbInstance as any)[prop];
  }
}) as DatabaseProxy;

export default db;
export { db };

/**
 * 执行数据库维护操作
 * @param operation - 维护操作类型：vacuum（释放空间）、analyze（更新统计信息）、integrity_check（完整性检查）
 */
export function performMaintenance(operation: 'vacuum' | 'analyze' | 'integrity_check'): void {
  const timer = logger.startTimer(`Database maintenance: ${operation}`);
  
  try {
    switch (operation) {
      case 'vacuum':
        // 重建数据库文件，释放未使用空间
        db.exec('VACUUM');
        logger.info('✅ VACUUM completed - reclaimed unused space');
        break;
      
      case 'analyze':
        // 更新查询优化器统计信息
        db.exec('ANALYZE');
        logger.info('✅ ANALYZE completed - updated query statistics');
        break;
      
      case 'integrity_check': {
        // 检查数据库完整性
        const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
        if (result[0]?.integrity_check === 'ok') {
          logger.info('✅ Integrity check passed - database is healthy');
        } else {
          logger.error('❌ Integrity check failed', undefined, { result });
        }
        break;
      }
    }
    
    timer.end(true);
  } catch (error) {
    logger.error(`Database maintenance failed: ${operation}`, error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats(): {
  size: string;
  pageCount: number;
  pageSize: number;
  cacheSize: number;
  walSize: number;
  tableCount: number;
  indexCount: number;
} {
  try {
    const pageCount = (db.pragma('page_count') as Array<{ page_count: number }>)[0]?.page_count || 0;
    const pageSize = (db.pragma('page_size') as Array<{ page_size: number }>)[0]?.page_size || 0;
    const cacheSize = (db.pragma('cache_size') as Array<{ cache_size: number }>)[0]?.cache_size || 0;
    const tableCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
    const indexCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as { count: number }).count;
    
    return {
      size: formatSize(pageCount * pageSize),
      pageCount,
      pageSize,
      cacheSize,
      walSize: getWalFileSize(),
      tableCount,
      indexCount
    };
  } catch (error) {
    logger.warn('Failed to get database stats', { error: (error as Error).message });
    return {
      size: '0 B',
      pageCount: 0,
      pageSize: 0,
      cacheSize: 0,
      walSize: 0,
      tableCount: 0,
      indexCount: 0
    };
  }
}

/**
 * 获取所有表的索引信息
 */
export function getTableIndexes(): Array<{
  tableName: string;
  indexName: string;
  columns: string;
  isUnique: boolean;
  rowCount: number;
}> {
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as Array<{ name: string }>;
    
    const indexes: Array<{ tableName: string; indexName: string; columns: string; isUnique: boolean; rowCount: number }> = [];
    
    for (const table of tables) {
      const tableIndexes = db.prepare(`PRAGMA index_list(${table.name})`).all() as Array<{ name: string; unique: number; origin: string }>;
      
      for (const idx of tableIndexes) {
        const columns = db.prepare(`PRAGMA index_info(${idx.name})`).all() as Array<{ name: string }>;
        const columnNames = columns.map(c => c.name).join(', ');
        
        const rowCountResult = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
        
        indexes.push({
          tableName: table.name,
          indexName: idx.name,
          columns: columnNames,
          isUnique: idx.unique === 1,
          rowCount: rowCountResult.count
        });
      }
    }
    
    return indexes;
  } catch (error) {
    logger.warn('Failed to get table indexes', { error: (error as Error).message });
    return [];
  }
}

/**
 * 获取慢查询建议
 */
export function getQuerySuggestions(): Array<{
  table: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}> {
  const suggestions: Array<{ table: string; suggestion: string; priority: 'high' | 'medium' | 'low' }> = [];
  
  try {
    const largeTables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all() as Array<{ name: string }>;
    
    for (const table of largeTables) {
      const count = (db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number }).count;
      
      if (count > 10000) {
        const indexes = db.prepare(`PRAGMA index_list(${table.name})`).all() as Array<Record<string, unknown>>;
        if (indexes.length < 2) {
          suggestions.push({
            table: table.name,
            suggestion: `表 ${table.name} 有 ${count} 行数据但索引较少，建议添加更多索引`,
            priority: 'high'
          });
        }
      }
      
      if (count > 100000) {
        suggestions.push({
          table: table.name,
          suggestion: `表 ${table.name} 数据量较大 (${count} 行)，考虑定期清理或分区`,
          priority: 'medium'
        });
      }
    }
  } catch (error) {
    logger.warn('Failed to get query suggestions', { error: (error as Error).message });
  }
  
  return suggestions;
}

/**
 * 获取WAL文件大小
 */
function getWalFileSize(): number {
  try {
    const walPath = `${env.DATABASE_PATH}-wal`;
    if (fs.existsSync(walPath)) {
      return fs.statSync(walPath).size;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

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
  const { migrateOldConfigToAIModels, migrateOldAgents } = await import('../services/aiModelService');
  migrateOldConfigToAIModels();
  migrateOldAgents();

  // 初始化默认数据
  initializeDefaultData();

  logger.info('✅ Database initialized successfully with preset configurations');
  
  startDatabaseMaintenance();
}

function initializeDefaultData(): void {
  // 默认服务器分组
  const groupCount = db.prepare('SELECT COUNT(*) as count FROM server_groups').get() as { count: number };
  if (groupCount.count === 0) {
    const insertGroup = db.prepare(`
      INSERT INTO server_groups (id, name, description, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const defaultGroup = randomUUID();
    const prodGroup = randomUUID();
    const devGroup = randomUUID();
    const testGroup = randomUUID();
    
    insertGroup.run(defaultGroup, '全部服务器', '所有服务器的根分组', null, 0);
    insertGroup.run(prodGroup, '生产环境', '生产环境服务器', defaultGroup, 1);
    insertGroup.run(devGroup, '开发环境', '开发环境服务器', defaultGroup, 2);
    insertGroup.run(testGroup, '测试环境', '测试环境服务器', defaultGroup, 3);
    
    logger.info('✅ 成功创建默认服务器分组');
  }

  // 默认管理员用户
  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (usersCount.count === 0) {
    initializeDefaultUsers();
  }

  // 预设 Agent
  logger.info('🔄 Initializing preset templates (always included)');
  
  const presetCount = db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_preset = 1').get() as { count: number };
  if (presetCount.count === 0) {
    initializePresetAgents();
  }
  
  logger.info('🔄 Updating preset agent model configurations...');
  
  let configuredModel: string | null = null;
  try {
    // 优先检查本地 AI（如果配置了非默认地址）
    const localAiApiBaseResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_API_BASE') as { value: string } | undefined;
    const localAiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('LOCAL_AI_MODEL') as { value: string } | undefined;
    
    if (localAiApiBaseResult && localAiApiBaseResult.value && 
        localAiApiBaseResult.value !== 'http://host.docker.internal:11434/v1') {
      configuredModel = localAiModelResult && localAiModelResult.value ? localAiModelResult.value : 'qwen2.5:7b';
    } else {
      // 检查豆包
      const doubaoKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_KEY') as { value: string } | undefined;
      const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL') as { value: string } | undefined;
      
      if (doubaoKeyResult && doubaoKeyResult.value && doubaoKeyResult.value !== 'your-doubao-api-key-here') {
        configuredModel = doubaoModelResult && doubaoModelResult.value ? doubaoModelResult.value : 'doubao-4o';
      } else {
        // 检查 OpenAI
        const openaiKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_KEY') as { value: string } | undefined;
        const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL') as { value: string } | undefined;
        
        if (openaiKeyResult && openaiKeyResult.value && openaiKeyResult.value !== 'your-openai-api-key-here') {
          configuredModel = openaiModelResult && openaiModelResult.value ? openaiModelResult.value : 'gpt-4o';
        }
      }
    }
  } catch (error: unknown) {
    logger.info('Error checking configured model, skipping preset agent update', { error: error instanceof Error ? error.message : String(error) });
  }
  
  if (configuredModel) {
    const updateStmt = db.prepare(`
      UPDATE agents 
      SET model = ?, updated_at = datetime('now','localtime') 
      WHERE is_preset = 1
    `);
    const result = updateStmt.run(configuredModel);
    logger.info(`✅ Updated ${result.changes} preset agents with model: ${configuredModel}`);
  } else {
    const updateStmt = db.prepare(`
      UPDATE agents 
      SET model = NULL, updated_at = datetime('now','localtime') 
      WHERE is_preset = 1
    `);
    const result = updateStmt.run();
    logger.info(`✅ Cleared model from ${result.changes} preset agents (no API keys configured)`);
  }

  // 预设工作流模板
  const workflowCount = db.prepare('SELECT COUNT(*) as count FROM workflows WHERE is_template = 1').get() as { count: number };
  if (workflowCount.count === 0) {
    initializePresetWorkflows();
  }

  // 预设报告模板
  const reportTemplatesCount = db.prepare('SELECT COUNT(*) as count FROM reports WHERE is_preset = 1 AND type = \'template\'').get() as { count: number };
  if (reportTemplatesCount.count === 0) {
    initializePresetReportTemplates();
  }

  // 预设知识库
  logger.info('🔄 Initializing preset configurations');
  
  const knowledgeCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number };
  if (knowledgeCount.count === 0) {
    initializePresetKnowledge();
  }

  // 预设脚本
  const scriptsCount = db.prepare('SELECT COUNT(*) as count FROM scripts').get() as { count: number };
  if (scriptsCount.count === 0) {
    initializePresetScripts();
  }

  // 预设告警映射
  initializeAlertMappings();

  // 预设定时任务
  const scheduledTasksCount = db.prepare('SELECT COUNT(*) as count FROM scheduled_tasks').get() as { count: number };
  if (scheduledTasksCount.count === 0) {
    initializePresetScheduledTasks();
  }

  // 预设修复策略 + 关联工作流
  const remediationCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number };
  if (remediationCount.count === 0) {
    initRemediationPolicies();
  }
  // 关联策略 → 工作流（智能匹配，创建额外高级策略）
  linkRemediationWorkflows();
}

/**
 * 生成随机强密码
 * @param length - 密码长度，默认16位
 * @returns 包含大小写字母、数字和特殊字符的强密码
 */
function generateStrongPassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + digits + special;

  // 确保每种类型至少有一个字符
  let password = '';
  password += uppercase[randomBytes(1).readUInt8(0) % uppercase.length];
  password += lowercase[randomBytes(1).readUInt8(0) % lowercase.length];
  password += digits[randomBytes(1).readUInt8(0) % digits.length];
  password += special[randomBytes(1).readUInt8(0) % special.length];

  // 剩余位随机填充
  for (let i = password.length; i < length; i++) {
    password += allChars[randomBytes(1).readUInt8(0) % allChars.length];
  }

  // 打乱字符顺序
  return password
    .split('')
    .sort(() => (randomBytes(1).readUInt8(0) % allChars.length) - (allChars.length / 2))
    .join('');
}

function initializeDefaultUsers() {
  // 幂等性检查：如果 admin 用户已存在则跳过
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existingAdmin) {
    logger.info('✅ Default admin user already exists, skipping initialization');
    return;
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin';
  const hashedPassword = bcrypt.hashSync(initialPassword, 12);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, password, email, role, enabled, password_must_change)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'admin', hashedPassword, 'admin@example.com', 'admin', 1, 1);

  if (process.env.ADMIN_INITIAL_PASSWORD) {
    logger.info('✅ Default admin user created with custom password');
  } else {
    logger.warn('⚠️ Default admin user created with password "admin" - CHANGE IT IMMEDIATELY');
    logger.warn('⚠️ Set ADMIN_INITIAL_PASSWORD env var for custom initial password');
  }
}

// ==================== 数据库定期维护任务 ====================

/**
 * 执行 VACUUM 操作：重建数据库文件，释放未使用空间
 * 注意：此操作会锁定数据库，建议在低峰期执行
 */
export function performVacuum(): void {
  const timer = logger.startTimer('Database VACUUM');
  try {
    db.exec('VACUUM');
    logger.info('✅ VACUUM completed - reclaimed unused space');
    timer.end(true);
  } catch (error) {
    logger.error('❌ VACUUM failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 执行 ANALYZE 操作：更新查询优化器统计信息
 * 提高查询计划质量，建议每周执行一次
 */
export function performAnalyze(): void {
  const timer = logger.startTimer('Database ANALYZE');
  try {
    db.exec('ANALYZE');
    logger.info('✅ ANALYZE completed - updated query optimizer statistics');
    timer.end(true);
  } catch (error) {
    logger.error('❌ ANALYZE failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 执行完整性检查：验证数据库文件完整性
 * 发现损坏时记录错误并告警
 */
export function performIntegrityCheck(): { ok: boolean; result: string } {
  const timer = logger.startTimer('Database Integrity Check');
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const isOk = result[0]?.integrity_check === 'ok';
    
    if (isOk) {
      logger.info('✅ Integrity check passed - database is healthy');
      timer.end(true);
      return { ok: true, result: 'ok' };
    } else {
      logger.error('❌ Integrity check failed', undefined, { result });
      timer.end(false);
      return { ok: false, result: result[0]?.integrity_check || 'unknown' };
    }
  } catch (error) {
    logger.error('❌ Integrity check failed with error', error as Error);
    timer.end(false);
    return { ok: false, result: (error as Error).message };
  }
}

/**
 * 执行 WAL 检查点：强制将 WAL 文件数据写入主数据库文件
 * 可手动触发以减少 WAL 文件大小
 */
export function performCheckpoint(): void {
  const timer = logger.startTimer('WAL Checkpoint');
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    logger.info('✅ WAL checkpoint completed - WAL file truncated');
    timer.end(true);
  } catch (error) {
    logger.error('❌ WAL checkpoint failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 获取数据库状态统计信息
 */
export function getDatabaseHealthStatus(): {
  pageCount: number;
  pageSize: number;
  walSize: number;
  cacheSize: number;
  tableCount: number;
  indexCount: number;
  totalSize: string;
  freePages: number;
} {
  try {
    const pageCount = (db.pragma('page_count') as Array<{ page_count: number }>)[0]?.page_count || 0;
    const pageSize = (db.pragma('page_size') as Array<{ page_size: number }>)[0]?.page_size || 0;
    const cacheSize = (db.pragma('cache_size') as Array<{ cache_size: number }>)[0]?.cache_size || 0;
    const freelistCount = (db.pragma('freelist_count') as Array<{ freelist_count: number }>)[0]?.freelist_count || 0;
    
    const tableCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number }).count;
    const indexCount = (db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'").get() as { count: number }).count;
    
    const walSize = getWalFileSize();
    const totalSize = formatSize(pageCount * pageSize);
    
    return {
      pageCount,
      pageSize,
      walSize,
      cacheSize,
      tableCount,
      indexCount,
      totalSize,
      freePages: freelistCount
    };
  } catch (error) {
    logger.warn('Failed to get database health status', { error: (error as Error).message });
    return {
      pageCount: 0,
      pageSize: 0,
      walSize: 0,
      cacheSize: 0,
      tableCount: 0,
      indexCount: 0,
      totalSize: '0 B',
      freePages: 0
    };
  }
}

/**
 * 执行完整的数据库维护流程
 * 包含：完整性检查、ANALYZE、WAL 检查点、VACUUM（可选）
 */
export function performFullMaintenance(options: { vacuum: boolean } = { vacuum: false }): void {
  if (isMaintenanceRunning) {
    logger.warn('⚠️ Database maintenance already in progress, skipping');
    return;
  }

  isMaintenanceRunning = true;
  const timer = logger.startTimer('Full Database Maintenance');

  try {
    logger.info('🔧 Starting full database maintenance...');
    
    // 1. 先执行完整性检查
    const integrity = performIntegrityCheck();
    if (!integrity.ok) {
      throw new Error(`Database integrity check failed: ${integrity.result}`);
    }

    // 2. 更新统计信息
    performAnalyze();

    // 3. WAL 检查点
    performCheckpoint();

    // 4. 可选：VACUUM（耗时较长）
    if (options.vacuum) {
      performVacuum();
    }

    const status = getDatabaseHealthStatus();
    logger.info('📊 Database status after maintenance', status);
    
    timer.end(true);
    logger.info('✅ Full database maintenance completed successfully');
  } catch (error) {
    logger.error('❌ Full database maintenance failed', error as Error);
    timer.end(false);
    throw error;
  } finally {
    isMaintenanceRunning = false;
  }
}

/**
 * 启动数据库定期维护任务
 * 执行频率：
 * - 每日：WAL 检查点（凌晨 3 点）
 * - 每周：ANALYZE（周日凌晨 3 点）
 * - 每月：VACUUM + 完整维护（每月 1 号凌晨 3 点）
 */
export function startDatabaseMaintenance(): void {
  if (maintenanceTimer) {
    logger.info('Database maintenance scheduler already running');
    return;
  }

  // 每小时检查一次是否需要执行维护任务
  maintenanceTimer = setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = 周日
    const dayOfMonth = now.getDate();

    // 凌晨 3 点执行维护任务（低峰期）
    if (hour === 3) {
      // 每日：WAL 检查点
      try {
        performCheckpoint();
      } catch (error) {
        logger.error('Daily WAL checkpoint failed', error as Error);
      }

      // 每周日：ANALYZE + 完整性检查
      if (dayOfWeek === 0) {
        try {
          performAnalyze();
          performIntegrityCheck();
          logger.info('✅ Weekly maintenance completed');
        } catch (error) {
          logger.error('Weekly maintenance failed', error as Error);
        }
      }

      // 每月 1 号：完整维护（包含 VACUUM）
      if (dayOfMonth === 1) {
        try {
          performFullMaintenance({ vacuum: true });
          logger.info('✅ Monthly full maintenance completed');
        } catch (error) {
          logger.error('Monthly maintenance failed', error as Error);
        }
      }
    }
  }, 60 * 60 * 1000); // 每小时检查一次

  maintenanceTimer.unref(); // 不阻止进程退出

  logger.info('✅ Database maintenance scheduler started');
  logger.info('📅 Maintenance schedule: Daily(WAL checkpoint), Weekly(ANALYZE), Monthly(VACUUM)');
}

/**
 * 停止数据库维护任务调度
 */
export function stopDatabaseMaintenance(): void {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
    logger.info('🛑 Database maintenance scheduler stopped');
  }
}

// 告警数据通过Webhook或API接口从监控系统接收，不再提供模拟数据
