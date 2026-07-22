import { randomUUID, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../../utils/logger';
import { db } from './core';
import { initializePresetAgents } from '../presets/initAgents';
import { initializePresetWorkflows } from '../presets/initWorkflows';
import { initializePresetReportTemplates } from '../presets/initReports';
import { initializePresetScripts } from '../presets/initScripts';
import { initializeAlertMappings } from '../presets/initAlertMappings';
import { initializePresetScheduledTasks } from '../presets/initScheduledTasks';
import { initRemediationPolicies } from '../presets/initRemediationPolicies';
import { linkRemediationWorkflows } from '../presets/linkRemediationWorkflows';
import { initConfigTemplates } from '../presets/initConfigTemplates';
import { initializeEnhancedWorkflows } from '../presets/initEnhancedWorkflows';

export function initializeDefaultData(): void {
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
    
    if (localAiApiBaseResult?.value && 
        localAiApiBaseResult.value !== 'http://host.docker.internal:11434/v1') {
      configuredModel = localAiModelResult?.value ? localAiModelResult.value : 'qwen2.5:7b';
    } else {
      // 检查豆包
      const doubaoKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_API_KEY') as { value: string } | undefined;
      const doubaoModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('DOUBAO_MODEL') as { value: string } | undefined;
      
      if (doubaoKeyResult?.value && doubaoKeyResult.value !== 'your-doubao-api-key-here') {
        configuredModel = doubaoModelResult?.value ? doubaoModelResult.value : 'doubao-4o';
      } else {
        // 检查 OpenAI
        const openaiKeyResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_API_KEY') as { value: string } | undefined;
        const openaiModelResult = db.prepare('SELECT value FROM settings WHERE key = ?').get('OPENAI_MODEL') as { value: string } | undefined;
        
        if (openaiKeyResult?.value && openaiKeyResult.value !== 'your-openai-api-key-here') {
          configuredModel = openaiModelResult?.value ? openaiModelResult.value : 'gpt-4o';
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

  // 知识库不再预置数据，由用户自行添加

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

  // 一次性清理：删除因历史 bug（randomUUID 导致重复插入）产生的旧 preset workflow 副本
  // 仅删除 is_template=1 且 id 不以 'preset-wf-' 开头的记录 — 安全不影响用户自定义工作流
  const legacyPresets = db.prepare(`
    SELECT COUNT(*) as count FROM workflows
    WHERE is_template = 1 AND id NOT LIKE 'preset-wf-%'
  `).get() as { count: number };
  if (legacyPresets.count > 0) {
    const delResult = db.prepare(`
      DELETE FROM workflows
      WHERE is_template = 1 AND id NOT LIKE 'preset-wf-%'
    `).run();
    logger.info(`🧹 清理历史重复 preset workflow: 删除 ${delResult.changes} 条`);
  }

  // 预设配置模板
  const configTemplateCount = db.prepare('SELECT COUNT(*) as count FROM config_templates').get() as { count: number };
  if (configTemplateCount.count === 0) {
    initConfigTemplates();
  }

  // 增强工作流
  initializeEnhancedWorkflows();
}

function generateRandomPassword(length = 16): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(length);
  return Array.from(bytes, b => charset[b % charset.length]).join('');
}

function initializeDefaultUsers() {
  // 幂等性检查：如果 admin 用户已存在则跳过
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (existingAdmin) {
    logger.info('✅ Default admin user already exists, skipping initialization');
    return;
  }

  const customPassword = process.env.ADMIN_INITIAL_PASSWORD;
  const initialPassword = customPassword || 'admin';
  const hashedPassword = bcrypt.hashSync(initialPassword, 12);
  const id = randomUUID();
  db.prepare(`
    INSERT INTO users (id, username, password, email, role, enabled, password_must_change)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, 'admin', hashedPassword, 'admin@example.com', 'admin', 1, 1);

  logger.info(`✅ Default admin user created. Username: admin, Password: ${customPassword ? '(from ADMIN_INITIAL_PASSWORD)' : 'admin'}`);
  if (!customPassword) {
    logger.warn('⚠️ Default password is "admin". Change it after first login or set ADMIN_INITIAL_PASSWORD env var.');
  }
}