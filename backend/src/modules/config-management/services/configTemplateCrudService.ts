/**
 * Config Template 路由层 CRUD 抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. 分页/过滤参数解析
 *   2. CRUD 操作
 *   3. 模板应用（调用 configTemplateService.apply）
 */
import { configTemplatesRepo } from '../../../repositories';
import type { ConfigTemplateCreateInput, ConfigTemplateUpdateInput } from '../../../repositories/infraRepository/types';

export const configTemplateCrudService = {
  // ── 查询 ──

  listTemplates(opts: { page: number; pageSize: number; filters?: Record<string, unknown> } = { page: 1, pageSize: 20 }) {
    const page = opts.page;
    const pageSize = opts.pageSize;
    const offset = (page - 1) * pageSize;
    return configTemplatesRepo.list({
      offset,
      limit: pageSize,
      ...(opts.filters || {}),
    });
  },

  getTemplateById(id: string) {
    return configTemplatesRepo.getById(id);
  },

  // ── 创建 ──

  createTemplate(data: Partial<ConfigTemplateCreateInput>) {
    return configTemplatesRepo.create(data as ConfigTemplateCreateInput);
  },

  // ── 更新 ──

  updateTemplate(id: string, data: Partial<ConfigTemplateUpdateInput>) {
    return configTemplatesRepo.update(id, data as ConfigTemplateUpdateInput);
  },

  // ── 删除 ──

  deleteTemplate(id: string) {
    return configTemplatesRepo.delete(id);
  },

  // ── 应用（批量到多台）──

  applyTemplate(templateId: string, targetIds: string[], variables: Record<string, unknown> = {}) {
    // 委托给 repository 的批量 apply（保持原行为）
    return configTemplatesRepo.apply(templateId, targetIds);
  },
};
