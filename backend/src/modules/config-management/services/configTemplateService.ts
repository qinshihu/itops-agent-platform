import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../utils/logger';
import { configTemplatesRepo, configTemplateHistoryRepo } from '../../../repositories';
import type { ConfigTemplate } from '../../../types';

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

    configTemplatesRepo.createFull({
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
    const updateInput: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      name: 'name', description: 'description', category: 'category',
      service_name: 'service_name', template_content: 'template_content',
      variables: 'variables', os_type: 'os_type', target_path: 'target_path',
      backup_before_apply: 'backup_before_apply', restart_command: 'restart_command',
      validation_command: 'validation_command', is_system: 'is_system',
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      const value = (updates as Record<string, unknown>)[key];
      if (value !== undefined) {
        updateInput[dbField] = typeof value === 'boolean' ? (value ? 1 : 0) : value;
      }
    }

    configTemplatesRepo.updateFull(id, updateInput);
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
    configTemplatesRepo.deleteFull(id);
    logger.info(`Deleted config template: ${id}`);
  }

  /**
   * 获取配置模板
   */
  getTemplate(id: string): ConfigTemplate {
    return configTemplatesRepo.getByIdOrThrow(id) as unknown as ConfigTemplate;
  }

  /**
   * 列出配置模板
   */
  listTemplates(filters: { category?: string; service_name?: string; os_type?: string; is_system?: boolean; page?: number; limit?: number }): { templates: ConfigTemplate[]; total: number } {
    const { templates, total } = configTemplatesRepo.listFull({
      category: filters.category,
      service_name: filters.service_name,
      os_type: filters.os_type,
      is_system: filters.is_system !== undefined ? (filters.is_system ? 1 : 0) : undefined,
      page: filters.page,
      limit: filters.limit,
    });

    return { templates: templates as unknown as ConfigTemplate[], total };
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
  ): Promise<unknown> {
    const template = this.getTemplate(templateId);
    const historyId = uuidv4();
    const now = new Date().toISOString();

    try {
      // 渲染模板
      const _renderedContent = this.renderTemplate(templateId, variables);

      // 记录应用历史
      configTemplateHistoryRepo.create({
        id: historyId,
        template_id: templateId,
        server_id: serverId,
        applied_by: userId || null,
        variables_snapshot: JSON.stringify(variables),
        status: 'pending',
        applied_at: now,
      });

      // 真实化应用流程（v3 报告 P1-7）：
      // 1. 通过 sshService.executeCommand() 在 serverId 上执行 shell 命令
      // 2. 步骤：备份(可选) → 写入新配置 → 重启(可选) → 验证(可选)
      // 3. 失败时返回失败状态而非静默成功
      if (!template.target_path) {
        throw new Error(`Template ${templateId} has no target_path configured`);
      }
      const { executeCommand } = await import('../../servers/services/sshService');
      let success = false;
      let backupPath: string | null = null;
      let errorMessage: string | null = null;
      try {
        // 1) 备份（如需）
        if (template.backup_before_apply) {
          backupPath = `${template.target_path}.bak.${Date.now()}`;
          await executeCommand(serverId, `cp -p ${template.target_path} ${backupPath}`, { logHistory: false });
        }
        // 2) 写入新配置（heredoc 原子写）
        const rendered = this.renderTemplate(templateId, variables);
        const writeCmd = `cat > ${template.target_path} << 'IT_OPS_EOF'\n${rendered}\nIT_OPS_EOF`;
        await executeCommand(serverId, writeCmd, { logHistory: false });
        // 3) 重启命令（可选）
        if (template.restart_command) {
          await executeCommand(serverId, template.restart_command, { logHistory: false });
        }
        // 4) 验证命令（可选，失败不阻塞）
        if (template.validation_command) {
          await executeCommand(serverId, template.validation_command, { logHistory: false });
        }
        success = true;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(`Failed to apply config template ${templateId} on server ${serverId}: ${errorMessage}`);
      }

      configTemplateHistoryRepo.updateStatus(
        historyId,
        success ? 'success' : 'failed',
        backupPath,
        success ? 'Configuration applied successfully' : (errorMessage || 'Failed to apply configuration'),
        now
      );

      // 更新模板使用统计
      configTemplatesRepo.incrementUsage(templateId, success, now);

      logger.info(`Applied config template ${template.name} to server ${serverId}: ${success ? 'success' : 'failed'}`);

      return this.getHistory(historyId);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to apply config template ${templateId}:`, error);

      configTemplateHistoryRepo.updateError(historyId, errorMsg, now);

      throw error;
    }
  }

  /**
   * 获取应用历史
   */
  getHistory(id: string): unknown {
    return configTemplateHistoryRepo.getByIdOrThrow(id);
  }

  /**
   * 列出应用历史
   */
  listHistory(filters: { template_id?: string; server_id?: string; status?: string; page?: number; limit?: number }): { histories: unknown[]; total: number } {
    return configTemplateHistoryRepo.list(filters);
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
    return configTemplatesRepo.getCategories();
  }

  /**
   * 获取所有服务名称
   */
  getServiceNames(): string[] {
    return configTemplatesRepo.getServiceNames();
  }
}

export const configTemplateService = new ConfigTemplateService();