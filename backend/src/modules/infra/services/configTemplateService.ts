import { v4 as uuidv4 } from 'uuid';
import db from '../../../models/database';
import { logger } from '../../../utils/logger';
import type { ConfigTemplate, ConfigTemplateHistory } from '../../../types';

class ConfigTemplateService {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    logger.info('Config template service initialized');
  }

  /**
   * 创建配置模板
   */
  createTemplate(template: Omit<ConfigTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'success_count'>): ConfigTemplate {
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO config_templates (
        id, name, description, category, service_name, template_content,
        variables, os_type, target_path, backup_before_apply,
        restart_command, validation_command, is_system,
        usage_count, success_count, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @category, @service_name, @template_content,
        @variables, @os_type, @target_path, @backup_before_apply,
        @restart_command, @validation_command, @is_system,
        0, 0, @created_at, @updated_at
      )
    `).run({
      id,
      name: template.name,
      description: template.description || null,
      category: template.category,
      service_name: template.service_name,
      template_content: template.template_content,
      variables: template.variables || null,
      os_type: template.os_type || 'linux',
      target_path: template.target_path || null,
      backup_before_apply: template.backup_before_apply ? 1 : 0,
      restart_command: template.restart_command || null,
      validation_command: template.validation_command || null,
      is_system: template.is_system ? 1 : 0,
      created_at: now,
      updated_at: now
    });

    return this.getTemplate(id);
  }

  /**
   * 更新配置模板
   */
  updateTemplate(id: string, updates: Partial<Pick<ConfigTemplate, 'name' | 'description' | 'category' | 'service_name' | 'template_content' | 'variables' | 'os_type' | 'target_path' | 'backup_before_apply' | 'restart_command' | 'validation_command' | 'is_system'>>): ConfigTemplate {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: Record<string, unknown> = { id, updated_at: now };

    const fieldMap: Record<string, keyof typeof updates> = {
      'name': 'name',
      'description': 'description',
      'category': 'category',
      'service_name': 'service_name',
      'template_content': 'template_content',
      'variables': 'variables',
      'os_type': 'os_type',
      'target_path': 'target_path',
      'backup_before_apply': 'backup_before_apply',
      'restart_command': 'restart_command',
      'validation_command': 'validation_command',
      'is_system': 'is_system'
    };

    for (const [dbField, key] of Object.entries(fieldMap)) {
      const value = updates[key];
      if (value !== undefined) {
        fields.push(`${dbField} = @${key}`);
        if (typeof value === 'boolean') {
          params[key] = value ? 1 : 0;
        } else {
          params[key] = value;
        }
      }
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = @updated_at');
    const sql = `UPDATE config_templates SET ${fields.join(', ')} WHERE id = @id`;

    db.prepare(sql).run(params);
    return this.getTemplate(id);
  }

  /**
   * 删除配置模板
   */
  deleteTemplate(id: string): void {
    const template = this.getTemplate(id);
    if (template.is_system) {
      throw new Error('Cannot delete system template');
    }
    db.prepare('DELETE FROM config_templates WHERE id = ?').run(id);
    logger.info(`Deleted config template: ${id}`);
  }

  /**
   * 获取配置模板
   */
  getTemplate(id: string): ConfigTemplate {
    const template = db.prepare('SELECT * FROM config_templates WHERE id = ?').get(id) as ConfigTemplate | undefined;
    if (!template) {
      throw new Error(`Config template not found: ${id}`);
    }
    return template;
  }

  /**
   * 列出配置模板
   */
  listTemplates(filters: { category?: string; service_name?: string; os_type?: string; is_system?: boolean; page?: number; limit?: number }): { templates: ConfigTemplate[]; total: number } {
    let sql = 'SELECT * FROM config_templates WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM config_templates WHERE 1=1';
    const params: unknown[] = [];

    if (filters.category) {
      sql += ' AND category = ?';
      countSql += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.service_name) {
      sql += ' AND service_name = ?';
      countSql += ' AND service_name = ?';
      params.push(filters.service_name);
    }

    if (filters.os_type) {
      sql += ' AND os_type = ?';
      countSql += ' AND os_type = ?';
      params.push(filters.os_type);
    }

    if (filters.is_system !== undefined) {
      sql += ' AND is_system = ?';
      countSql += ' AND is_system = ?';
      params.push(filters.is_system ? 1 : 0);
    }

    sql += ' ORDER BY category, service_name, created_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const templates = db.prepare(sql).all(...params) as ConfigTemplate[];
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { templates, total: totalResult.count };
  }

  /**
   * 渲染模板内容（变量替换）
   */
  renderTemplate(templateId: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateId);
    let content = template.template_content;

    // 替换 {{variable}} 格式的变量
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }

    return content;
  }

  /**
   * 应用配置模板到服务器
   */
  async applyTemplate(
    templateId: string,
    serverId: string,
    variables: Record<string, string>,
    userId?: string
  ): Promise<ConfigTemplateHistory> {
    const template = this.getTemplate(templateId);
    const historyId = uuidv4();
    const now = new Date().toISOString();

    try {
      // 渲染模板
      const _renderedContent = this.renderTemplate(templateId, variables);

      // 记录应用历史
      db.prepare(`
        INSERT INTO config_template_history (
          id, template_id, server_id, applied_by, variables_snapshot,
          status, applied_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `).run(
        historyId,
        templateId,
        serverId,
        userId || null,
        JSON.stringify(variables),
        now
      );

      // TODO: 实际执行配置应用（通过 SSH 服务）
      // 这里需要集成 sshService 来执行：
      // 1. 备份现有配置（如果 backup_before_apply = 1）
      // 2. 写入新配置到 target_path
      // 3. 执行 restart_command
      // 4. 执行 validation_command 验证

      // 模拟成功（实际实现需要 SSH 集成）
      const success = true;
      const backupPath = template.backup_before_apply ? `${template.target_path}.bak.${Date.now()}` : null;

      db.prepare(`
        UPDATE config_template_history
        SET status = ?, backup_path = ?, result = ?, applied_at = ?
        WHERE id = ?
      `).run(
        success ? 'success' : 'failed',
        backupPath,
        success ? 'Configuration applied successfully' : 'Failed to apply configuration',
        now,
        historyId
      );

      // 更新模板使用统计
      db.prepare(`
        UPDATE config_templates
        SET usage_count = usage_count + 1,
            success_count = success_count + CASE WHEN ? THEN 1 ELSE 0 END,
            updated_at = ?
        WHERE id = ?
      `).run(success ? 1 : 0, now, templateId);

      logger.info(`Applied config template ${template.name} to server ${serverId}: ${success ? 'success' : 'failed'}`);

      return this.getHistory(historyId);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to apply config template ${templateId}:`, error);

      db.prepare(`
        UPDATE config_template_history
        SET status = 'failed', error_message = ?, applied_at = ?
        WHERE id = ?
      `).run(errorMsg, now, historyId);

      throw error;
    }
  }

  /**
   * 获取应用历史
   */
  getHistory(id: string): ConfigTemplateHistory {
    const history = db.prepare('SELECT * FROM config_template_history WHERE id = ?').get(id) as ConfigTemplateHistory | undefined;
    if (!history) {
      throw new Error(`Config template history not found: ${id}`);
    }
    return history;
  }

  /**
   * 列出应用历史
   */
  listHistory(filters: { template_id?: string; server_id?: string; status?: string; page?: number; limit?: number }): { histories: ConfigTemplateHistory[]; total: number } {
    let sql = 'SELECT * FROM config_template_history WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as count FROM config_template_history WHERE 1=1';
    const params: unknown[] = [];

    if (filters.template_id) {
      sql += ' AND template_id = ?';
      countSql += ' AND template_id = ?';
      params.push(filters.template_id);
    }

    if (filters.server_id) {
      sql += ' AND server_id = ?';
      countSql += ' AND server_id = ?';
      params.push(filters.server_id);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      countSql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY applied_at DESC';

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const histories = db.prepare(sql).all(...params) as ConfigTemplateHistory[];
    const totalResult = db.prepare(countSql).get(...params) as { count: number };

    return { histories, total: totalResult.count };
  }

  /**
   * 获取模板变量列表
   */
  getTemplateVariables(templateId: string): Array<{ name: string; description?: string; default?: string }> {
    const template = this.getTemplate(templateId);
    if (!template.variables) return [];

    try {
      return JSON.parse(template.variables);
    } catch {
      return [];
    }
  }

  /**
   * 验证模板语法
   */
  validateTemplate(templateContent: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查变量格式
    const variablePattern = /`{`{([^}]+)`}`}/g;
    const matches = [...templateContent.matchAll(variablePattern)];

    if (matches.length === 0) {
      errors.push('Template contains no variables');
    }

    // 检查是否有未闭合的变量
    const openBraces = (templateContent.match(/`{`{/g) || []).length;
    const closeBraces = (templateContent.match(/`}`}/g) || []).length;

    if (openBraces !== closeBraces) {
      errors.push('Unbalanced variable braces');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 获取所有分类
   */
  getCategories(): string[] {
    const result = db.prepare('SELECT DISTINCT category FROM config_templates ORDER BY category').all() as Array<{ category: string }>;
    return result.map(r => r.category);
  }

  /**
   * 获取所有服务名称
   */
  getServiceNames(): string[] {
    const result = db.prepare('SELECT DISTINCT service_name FROM config_templates ORDER BY service_name').all() as Array<{ service_name: string }>;
    return result.map(r => r.service_name);
  }
}

export const configTemplateService = new ConfigTemplateService();
