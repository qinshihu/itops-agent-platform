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
import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getIOInstance() {
  return ioInstance;
}

const DB_PATH = env.DATABASE_PATH;
const dbDir = path.dirname(DB_PATH);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db: Database.Database = new Database(DB_PATH);

// SQLite 性能优化配置
// 1. WAL模式 - 写入不阻塞读取，提升并发性能
db.pragma('journal_mode = WAL');

// 2. 外键约束 - 保证数据一致性
db.pragma('foreign_keys = ON');

// 3. 忙等待超时 - 避免锁竞争时立即失败，等待5秒
db.pragma('busy_timeout = 5000');

// 4. 同步模式 - FULL确保断电/崩溃时事务不丢失（生产环境推荐）
db.pragma('synchronous = FULL');

// 5. 临时表存储 - 使用内存提升排序/临时查询性能
db.pragma('temp_store = MEMORY');

// 6. 内存映射 - 允许直接内存访问大文件（1GB）
db.pragma('mmap_size = 1073741824');

// 7. 页面缓存 - 64MB缓存（-64000表示KB），减少磁盘IO
db.pragma('cache_size = -64000');

// 8. WAL自动检查点 - 每1000页自动检查点，控制WAL文件大小
db.pragma('wal_autocheckpoint = 1000');

// 9. 缓存溢出 - 允许缓存溢出到磁盘，避免内存不足
db.pragma('cache_spill = ON');

// 10. 日志大小限制 - WAL文件最大100MB，自动回收
db.pragma('journal_size_limit = 104857600');

// 11. 锁定模式 - 允许共享锁，提升并发读
db.pragma('locking_mode = NORMAL');

// 12. 自动索引 - 允许自动创建临时索引优化查询
db.pragma('automatic_index = ON');

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
    const walPath = `${DB_PATH}-wal`;
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

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id TEXT,
      reason TEXT,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      password_must_change INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      port INTEGER DEFAULT 22,
      username TEXT NOT NULL,
      password TEXT,
      private_key TEXT,
      use_ssh_key INTEGER DEFAULT 0,
      description TEXT,
      tags TEXT,
      enabled INTEGER DEFAULT 1,
      last_connected DATETIME,
      os TEXT,
      cpu_cores INTEGER,
      memory_gb REAL,
      disk_gb REAL,
      ip_address TEXT,
      private_ip TEXT,
      cloud_provider TEXT,
      cloud_instance_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers(enabled);

    CREATE TABLE IF NOT EXISTS server_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES server_groups(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_server_groups_parent ON server_groups(parent_id);

    CREATE TABLE IF NOT EXISTS server_group_mapping (
      server_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      PRIMARY KEY (server_id, group_id),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_server_group_mapping_server ON server_group_mapping(server_id);
    CREATE INDEX IF NOT EXISTS idx_server_group_mapping_group ON server_group_mapping(group_id);

    CREATE TABLE IF NOT EXISTS server_command_history (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      command TEXT NOT NULL,
      stdout TEXT,
      stderr TEXT,
      success INTEGER DEFAULT 0,
      execution_time_ms INTEGER,
      executed_by TEXT,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cmd_history_server_id ON server_command_history(server_id);
    CREATE INDEX IF NOT EXISTS idx_cmd_history_executed_at ON server_command_history(executed_at);

    CREATE TABLE IF NOT EXISTS compliance_checks (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      check_name TEXT NOT NULL,
      check_results TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_compliance_server_id ON compliance_checks(server_id);
    CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_checks(status);
    CREATE INDEX IF NOT EXISTS idx_compliance_created_at ON compliance_checks(created_at);

    CREATE TABLE IF NOT EXISTS encryption_keys (
      id TEXT PRIMARY KEY,
      key_type TEXT NOT NULL,
      key_value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      active INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_encryption_active ON encryption_keys(active);

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      role TEXT,
      system_prompt TEXT,
      model TEXT DEFAULT 'doubao-4o',
      temperature REAL DEFAULT 0.7,
      enabled INTEGER DEFAULT 1,
      is_preset INTEGER DEFAULT 0,
      category TEXT,
      tags TEXT,
      description TEXT,
      usage_count INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS agent_executions (
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);

    CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
    CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count);

    CREATE INDEX IF NOT EXISTS idx_agents_is_preset ON agents(is_preset);
    CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      nodes TEXT,
      edges TEXT,
      agent_configs TEXT,
      is_template INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      name TEXT,
      status TEXT DEFAULT 'pending',
      start_time DATETIME,
      end_time DATETIME,
      current_node_id TEXT,
      node_results TEXT,
      logs TEXT,
      context TEXT,
      metrics TEXT,
      execution_order TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      metadata TEXT,
      related_task_id TEXT,
      status TEXT DEFAULT 'new',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT,
      content TEXT NOT NULL,
      tags TEXT,
      solutions TEXT,
      related_alerts TEXT,
      usage_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
    CREATE INDEX IF NOT EXISTS idx_kb_usage ON knowledge_base(usage_count);

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      language TEXT DEFAULT 'bash',
      tags TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'generated',
      content TEXT,
      format TEXT DEFAULT 'markdown',
      template_id TEXT,
      task_id TEXT,
      variables TEXT,
      metadata TEXT,
      is_preset INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
    CREATE INDEX IF NOT EXISTS idx_reports_task_id ON reports(task_id);
    CREATE INDEX IF NOT EXISTS idx_reports_template_id ON reports(template_id);
    CREATE INDEX IF NOT EXISTS idx_reports_is_preset ON reports(is_preset);
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

    CREATE TABLE IF NOT EXISTS report_schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template_id TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      recipients TEXT,
      format TEXT DEFAULT 'markdown',
      last_generated DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled ON report_schedules(enabled);
    CREATE INDEX IF NOT EXISTS idx_report_schedules_template ON report_schedules(template_id);

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      workflow_id TEXT NOT NULL,
      schedule TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run DATETIME,
      next_run DATETIME,
      context TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_enabled ON scheduled_tasks(enabled);

    CREATE TABLE IF NOT EXISTS alert_workflow_mappings (
      id TEXT PRIMARY KEY,
      alert_source TEXT,
      alert_severity TEXT,
      alert_title_pattern TEXT,
      workflow_id TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alert_mapping_enabled ON alert_workflow_mappings(enabled);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      status TEXT DEFAULT 'unread',
      recipient TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS notification_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_enabled INTEGER DEFAULT 1,
      webhook_url TEXT,
      email_enabled INTEGER DEFAULT 0,
      email_config TEXT,
      wechat_enabled INTEGER DEFAULT 0,
      wechat_config TEXT,
      dingtalk_enabled INTEGER DEFAULT 0,
      dingtalk_config TEXT,
      alert_notification TEXT,
      task_notification TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS root_cause_analyses (
      id TEXT PRIMARY KEY,
      alert_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      root_cause TEXT,
      symptoms TEXT,
      timeline TEXT,
      evidence TEXT,
      recommendations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (alert_id) REFERENCES alerts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_rca_alert_id ON root_cause_analyses(alert_id);
    CREATE INDEX IF NOT EXISTS idx_rca_status ON root_cause_analyses(status);
    CREATE INDEX IF NOT EXISTS idx_rca_created ON root_cause_analyses(created_at);
    
    CREATE TABLE IF NOT EXISTS copilot_conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      messages TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_copilot_user_id ON copilot_conversations(user_id);

    CREATE TABLE IF NOT EXISTS alert_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      channels TEXT NOT NULL,
      webhook_url TEXT,
      email_recipients TEXT,
      rate_limit_minutes INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled);
    CREATE INDEX IF NOT EXISTS idx_alert_configs_level ON alert_configs(level);

    CREATE TABLE IF NOT EXISTS alert_notifications (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      metadata TEXT,
      channels TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_alert_notifications_config_id ON alert_notifications(config_id);
    CREATE INDEX IF NOT EXISTS idx_alert_notifications_level ON alert_notifications(level);
    CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered_at ON alert_notifications(triggered_at);
  `);

  runMigrations();

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

  const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (usersCount.count === 0) {
    initializeDefaultUsers();
  }

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
      SET model = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE is_preset = 1
    `);
    const result = updateStmt.run(configuredModel);
    logger.info(`✅ Updated ${result.changes} preset agents with model: ${configuredModel}`);
  } else {
    const updateStmt = db.prepare(`
      UPDATE agents 
      SET model = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE is_preset = 1
    `);
    const result = updateStmt.run();
    logger.info(`✅ Cleared model from ${result.changes} preset agents (no API keys configured)`);
  }

  const workflowCount = db.prepare('SELECT COUNT(*) as count FROM workflows WHERE is_template = 1').get() as { count: number };
  if (workflowCount.count === 0) {
    initializePresetWorkflows();
  }

  const reportTemplatesCount = db.prepare('SELECT COUNT(*) as count FROM reports WHERE is_preset = 1 AND type = \'template\'').get() as { count: number };
  if (reportTemplatesCount.count === 0) {
    initializePresetReportTemplates();
  }

  logger.info('🔄 Initializing preset configurations');
  
  const knowledgeCount = db.prepare('SELECT COUNT(*) as count FROM knowledge_base').get() as { count: number };
  if (knowledgeCount.count === 0) {
    initializePresetKnowledge();
  }

  const scriptsCount = db.prepare('SELECT COUNT(*) as count FROM scripts').get() as { count: number };
  if (scriptsCount.count === 0) {
    initializePresetScripts();
  }

  const mappingsCount = db.prepare('SELECT COUNT(*) as count FROM alert_workflow_mappings').get() as { count: number };
  if (mappingsCount.count === 0) {
    initializeAlertMappings();
  }

  const scheduledTasksCount = db.prepare('SELECT COUNT(*) as count FROM scheduled_tasks').get() as { count: number };
  if (scheduledTasksCount.count === 0) {
    initializePresetScheduledTasks();
  }

  const remediationCount = db.prepare('SELECT COUNT(*) as count FROM remediation_policies').get() as { count: number };
  if (remediationCount.count === 0) {
    initRemediationPolicies();
  }

  logger.info('✅ Database initialized successfully with preset configurations');
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
  // Read initial password from env var, fallback to 'admin'
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'admin';
  const hashedPassword = bcrypt.hashSync(initialPassword, 12);
  db.prepare(`
    INSERT INTO users (username, password, email, role, enabled, password_must_change)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin', hashedPassword, 'admin@example.com', 'admin', 1, 1);
  
  logger.info(`✅ Default admin user created: admin / ${initialPassword === 'admin' ? 'admin' : '(from env)'}`);
  logger.info('⚠️  User will be forced to change password on first login');
  logger.info('⚠️  Please change the default password immediately after first login');
}

// 告警数据通过Webhook或API接口从监控系统接收，不再提供模拟数据
