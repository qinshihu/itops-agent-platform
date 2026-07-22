/**
 * =============================================================================
 * 配置文件自动修复核心服务
 * =============================================================================
 * 初始化、模板管理，业务逻辑委托给 detection / repairStrategies / verification
 */

import { logger } from '../../../../utils/logger';
import type {
  ConfigTemplate,
  ConfigAnalysis,
  ConfigIssue,
  RepairPlan,
  RepairRecord,
} from '../../../../types/configRepair';
import { configFileTemplateRepository } from '../../../../repositories';
import type { ConfigFileTemplate } from '../../../../repositories';
import { analyzeConfig, findMatchingTemplate, type DetectionDeps } from './detection';
import { generateRepairPlan, executeRepair, rollbackRepair, type RepairDeps } from './repairStrategies';
import { getRepairRecord, listRepairRecords, saveRepairRecord as _saveRepairRecord } from './verification';

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
        const existing = configFileTemplateRepository.getById(template.id);
        if (!existing) {
          const now = new Date().toISOString();
          configFileTemplateRepository.create({
            id: template.id,
            name: template.name,
            path: template.path,
            parser: template.parser,
            validator: template.validator ?? null,
            reload_cmd: template.reloadCmd ?? null,
            backup_dir: template.backupDir,
            description: template.description ?? null,
            is_preset: template.isPreset ? 1 : 0,
            created_at: now,
          } as ConfigFileTemplate);
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

  // ── 委托方法 ──

  private get detectionDeps(): DetectionDeps {
    return {
      templates: this.templates,
      getTemplate: this.getTemplate.bind(this),
    };
  }

  private get repairDeps(): RepairDeps {
    return {
      templates: this.templates,
      getTemplate: this.getTemplate.bind(this),
    };
  }

  /**
   * 分析配置文件（委托给 detection）
   */
  async analyzeConfig(
    deviceId: string,
    configPath: string,
    content: string,
    templateId?: string
  ): Promise<ConfigAnalysis> {
    return analyzeConfig(this.detectionDeps, deviceId, configPath, content, templateId);
  }

  /**
   * 自动匹配模板（委托给 detection）
   */
  private findMatchingTemplateInstance(configPath: string): ConfigTemplate | null {
    return findMatchingTemplate(this.detectionDeps, configPath);
  }

  /**
   * 生成修复方案（委托给 repairStrategies）
   */
  async generateRepairPlan(
    deviceId: string,
    deviceName: string,
    deviceIp: string,
    configPath: string,
    issues: ConfigIssue[],
    content: string
  ): Promise<RepairPlan> {
    return generateRepairPlan(this.repairDeps, deviceId, deviceName, deviceIp, configPath, issues, content);
  }

  /**
   * 执行修复（委托给 repairStrategies）
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
    return executeRepair(this.repairDeps, deviceId, deviceName, deviceIp, configPath, repairPlan, templateId, approver);
  }

  /**
   * 回滚修复（委托给 repairStrategies）
   */
  async rollbackRepair(recordId: string): Promise<boolean> {
    return rollbackRepair(recordId);
  }

  /**
   * 获取修复记录（委托给 verification）
   */
  getRepairRecord(recordId: string): RepairRecord | null {
    return getRepairRecord(recordId);
  }

  /**
   * 获取修复记录列表（委托给 verification）
   */
  listRepairRecords(deviceId?: string, limit = 50): RepairRecord[] {
    return listRepairRecords(deviceId, limit);
  }
}

export const configRepairService = new ConfigRepairService();