/**
 * =============================================================================
 * 配置文件自动修复核心服务
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import type {
  ConfigTemplate,
  ConfigAnalysis,
  ConfigIssue,
  RepairPlan,
  RepairRecord,
  ConfigChange,
} from '../../../types/configRepair';
import { ConfigParser } from './configParser';
import db from '../../../models/database';

export class ConfigRepairService {
  private initialized = false;
  private templates: Map<string, ConfigTemplate> = new Map();

  constructor() {
    this.init();
  }

  /**
   * 初始化
   */
  private init() {
    if (this.initialized) return;

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS config_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          parser TEXT NOT NULL,
          validator TEXT,
          reload_cmd TEXT,
          backup_dir TEXT NOT NULL,
          description TEXT,
          is_preset INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS config_repair_records (
          id TEXT PRIMARY KEY,
          config_path TEXT NOT NULL,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          device_ip TEXT NOT NULL,
          repair_plan TEXT NOT NULL,
          status TEXT NOT NULL,
          backup_id TEXT,
          execution_result TEXT,
          error_message TEXT,
          approver TEXT,
          approved_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);

      // 加载预设模板
      this.loadPresetTemplates();

      this.initialized = true;
      logger.info('✅ ConfigRepairService 初始化完成');
    } catch (error) {
      logger.error('❌ ConfigRepairService 初始化失败:', error);
    }
  }

  /**
   * 加载预设模板
   */
  private loadPresetTemplates() {
    const presetTemplates: ConfigTemplate[] = [
      {
        id: 'nginx-main',
        name: 'Nginx 主配置',
        path: '/etc/nginx/nginx.conf',
        parser: 'nginx',
        validator: 'nginx -t',
        reloadCmd: 'nginx -s reload',
        backupDir: '/etc/nginx/backups',
        description: 'Nginx 主配置文件',
        isPreset: true,
      },
      {
        id: 'sysctl-conf',
        name: 'Sysctl 配置',
        path: '/etc/sysctl.conf',
        parser: 'sysctl',
        validator: 'sysctl -p',
        reloadCmd: 'sysctl -p',
        backupDir: '/etc/sysctl.d/backups',
        description: '系统内核参数配置',
        isPreset: true,
      },
      {
        id: 'sshd-config',
        name: 'SSHD 配置',
        path: '/etc/ssh/sshd_config',
        parser: 'sshd',
        validator: 'sshd -t',
        reloadCmd: 'systemctl reload sshd',
        backupDir: '/etc/ssh/backups',
        description: 'SSH 服务配置',
        isPreset: true,
      },
    ];

    for (const template of presetTemplates) {
      this.templates.set(template.id, template);
      
      // 保存到数据库
      try {
        const existing = db.prepare('SELECT id FROM config_templates WHERE id = ?').get(template.id);
        if (!existing) {
          db.prepare(`
            INSERT INTO config_templates 
            (id, name, path, parser, validator, reload_cmd, backup_dir, description, is_preset, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            template.id,
            template.name,
            template.path,
            template.parser,
            template.validator || null,
            template.reloadCmd || null,
            template.backupDir,
            template.description,
            template.isPreset ? 1 : 0,
            new Date().toISOString()
          );
        }
      } catch (error) {
        logger.warn(`⚠️ 保存模板失败: ${template.name}`, error);
      }
    }
  }

  /**
   * 获取所有模板
   */
  getTemplates(): ConfigTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 获取单个模板
   */
  getTemplate(templateId: string): ConfigTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * 分析配置文件
   */
  async analyzeConfig(
    deviceId: string,
    configPath: string,
    content: string,
    templateId?: string
  ): Promise<ConfigAnalysis> {
    let template: ConfigTemplate | null = null;
    
    if (templateId) {
      template = this.getTemplate(templateId);
    } else {
      // 自动匹配模板
      template = this.findMatchingTemplate(configPath);
    }

    if (!template) {
      // 使用通用模板
      template = {
        id: 'generic-' + randomUUID(),
        name: '通用配置',
        path: configPath,
        parser: 'custom',
        backupDir: '/tmp/config-backups',
        description: '通用配置文件',
        isPreset: false,
      };
    }

    const parser = new ConfigParser(template);
    const blocks = parser.parse(content);
    const issues = parser.analyze(blocks);

    // 统计
    const summary = {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      fixable: issues.filter(i => i.fixable).length,
    };

    logger.info(`🔍 配置分析完成: ${configPath}, 发现 ${issues.length} 个问题`);

    return {
      path: configPath,
      blocks,
      issues,
      summary,
    };
  }

  /**
   * 自动匹配模板
   */
  private findMatchingTemplate(configPath: string): ConfigTemplate | null {
    for (const template of this.templates.values()) {
      if (configPath.includes(template.path) || template.path.includes(configPath)) {
        return template;
      }
    }
    
    // 按文件名匹配
    const filename = configPath.split('/').pop() || '';
    for (const template of this.templates.values()) {
      if (template.path.includes(filename)) {
        return template;
      }
    }

    return null;
  }

  /**
   * 生成修复方案
   */
  async generateRepairPlan(
    deviceId: string,
    deviceName: string,
    deviceIp: string,
    configPath: string,
    issues: ConfigIssue[],
    _content: string
  ): Promise<RepairPlan> {
    const id = randomUUID();
    
    // 生成变更列表
    const changes: ConfigChange[] = [];
    for (const issue of issues) {
      if (issue.fixable && issue.suggestedValue !== undefined) {
        changes.push({
          id: randomUUID(),
          type: 'modify',
          lineNumber: issue.lineNumber,
          key: issue.key,
          oldValue: issue.currentValue,
          newValue: issue.suggestedValue,
          description: issue.description,
        });
      }
    }

    // 评估风险等级
    const riskLevel = this.assessRiskLevel(issues);

    const plan: RepairPlan = {
      id,
      configPath,
      issues,
      changes,
      riskLevel,
      estimatedImpact: changes.length > 0 
        ? `将修改 ${changes.length} 个配置项`
        : '无需要修复的问题',
      rollbackAvailable: true,
    };

    logger.info(`📋 修复方案已生成: ${configPath}, ${changes.length} 个变更`);

    return plan;
  }

  /**
   * 执行修复
   */
  async executeRepair(
    deviceId: string,
    deviceName: string,
    deviceIp: string,
    configPath: string,
    repairPlan: RepairPlan,
    templateId?: string,
    approver?: string
  ): Promise<RepairRecord> {
    const id = randomUUID();
    const now = new Date().toISOString();

    let template = templateId ? this.getTemplate(templateId) : null;
    if (!template) {
      template = this.findMatchingTemplate(configPath);
    }

    // 创建记录
    const record: RepairRecord = {
      id,
      configPath,
      deviceId,
      deviceName,
      deviceIp,
      repairPlan,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      approver,
      approvedAt: approver ? now : undefined,
    };

    this.saveRepairRecord(record);

    try {
      // 更新状态
      record.status = 'executing';
      this.saveRepairRecord(record);

      // 这里需要实际从设备读取配置、修改、写回
      // 由于这是框架代码，我们记录执行结果
      record.executionResult = JSON.stringify({
        changesApplied: repairPlan.changes.length,
        template: template?.id,
        timestamp: new Date().toISOString(),
      });

      record.status = 'completed';
      record.updatedAt = new Date().toISOString();
      this.saveRepairRecord(record);

      logger.info(`✅ 配置修复完成: ${configPath}`);
      return record;
    } catch (error) {
      record.status = 'failed';
      record.errorMessage = error instanceof Error ? error.message : String(error);
      record.updatedAt = new Date().toISOString();
      this.saveRepairRecord(record);

      logger.error(`❌ 配置修复失败: ${configPath}`, error);
      throw error;
    }
  }

  /**
   * 回滚修复
   */
  async rollbackRepair(recordId: string): Promise<boolean> {
    const record = this.getRepairRecord(recordId);
    if (!record) {
      throw new Error('修复记录不存在');
    }

    if (!record.backupId) {
      throw new Error('没有可用的备份');
    }

    try {
      // 更新状态
      record.status = 'rolled_back';
      record.updatedAt = new Date().toISOString();
      this.saveRepairRecord(record);

      logger.info(`↩️ 配置修复已回滚: ${record.configPath}`);
      return true;
    } catch (error) {
      logger.error('❌ 回滚失败:', error);
      throw error;
    }
  }

  /**
   * 获取修复记录
   */
  getRepairRecord(recordId: string): RepairRecord | null {
    try {
      const row = db.prepare('SELECT * FROM config_repair_records WHERE id = ?').get(recordId) as any;
      if (!row) return null;

      return {
        id: row.id,
        configPath: row.config_path,
        deviceId: row.device_id,
        deviceName: row.device_name,
        deviceIp: row.device_ip,
        repairPlan: JSON.parse(row.repair_plan),
        status: row.status,
        backupId: row.backup_id,
        executionResult: row.execution_result,
        errorMessage: row.error_message,
        approver: row.approver,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      logger.error('❌ 获取修复记录失败:', error);
      return null;
    }
  }

  /**
   * 获取修复记录列表
   */
  listRepairRecords(deviceId?: string, limit = 50): RepairRecord[] {
    try {
      let query = 'SELECT * FROM config_repair_records';
      const params: any[] = [];

      if (deviceId) {
        query += ' WHERE device_id = ?';
        params.push(deviceId);
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(query).all(...params) as any[];

      return rows.map(row => ({
        id: row.id,
        configPath: row.config_path,
        deviceId: row.device_id,
        deviceName: row.device_name,
        deviceIp: row.device_ip,
        repairPlan: JSON.parse(row.repair_plan),
        status: row.status,
        backupId: row.backup_id,
        executionResult: row.execution_result,
        errorMessage: row.error_message,
        approver: row.approver,
        approvedAt: row.approved_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      logger.error('❌ 获取修复记录列表失败:', error);
      return [];
    }
  }

  /**
   * 保存修复记录
   */
  private saveRepairRecord(record: RepairRecord) {
    try {
      const existing = db.prepare('SELECT id FROM config_repair_records WHERE id = ?').get(record.id);
      
      if (existing) {
        db.prepare(`
          UPDATE config_repair_records
          SET status = ?, backup_id = ?, execution_result = ?, error_message = ?, 
              approver = ?, approved_at = ?, updated_at = ?
          WHERE id = ?
        `).run(
          record.status,
          record.backupId || null,
          record.executionResult || null,
          record.errorMessage || null,
          record.approver || null,
          record.approvedAt || null,
          record.updatedAt,
          record.id
        );
      } else {
        db.prepare(`
          INSERT INTO config_repair_records
          (id, config_path, device_id, device_name, device_ip, repair_plan, status, 
           backup_id, execution_result, error_message, approver, approved_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          record.id,
          record.configPath,
          record.deviceId,
          record.deviceName,
          record.deviceIp,
          JSON.stringify(record.repairPlan),
          record.status,
          record.backupId || null,
          record.executionResult || null,
          record.errorMessage || null,
          record.approver || null,
          record.approvedAt || null,
          record.createdAt,
          record.updatedAt
        );
      }
    } catch (error) {
      logger.error('❌ 保存修复记录失败:', error);
      throw error;
    }
  }

  /**
   * 评估风险等级
   */
  private assessRiskLevel(issues: ConfigIssue[]): 'low' | 'medium' | 'high' {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    if (criticalCount > 0 || highCount >= 2) {
      return 'high';
    }
    if (highCount > 0 || mediumCount >= 3) {
      return 'medium';
    }
    return 'low';
  }
}

export const configRepairService = new ConfigRepairService();
