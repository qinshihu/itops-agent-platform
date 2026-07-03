/**
 * Config Management 模块 API 层
 * 封装配置模板、配置修复相关的 API 端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

export interface ConfigTemplate {
  id: string;
  name: string;
  type: string;
  target_type: string;
  description?: string;
  content?: string;
  variables?: string[];
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface ConfigTemplateInput {
  name: string;
  type: string;
  target_type: string;
  description?: string;
  content: string;
  variables?: string[];
  tags?: string[];
}

export interface ConfigTemplateListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  target_type?: string;
}

export interface RenderResult {
  success: boolean;
  output?: string;
  error?: string;
}

// ============================================================
// configManagementApi 对象
// ============================================================

export const configManagementApi = {
  /** 获取配置模板列表 */
  async list(params?: ConfigTemplateListParams): Promise<{ templates: ConfigTemplate[]; total: number }> {
    const { data } = await api.get('/api/config-templates', { params });
    return data.data;
  },

  /** 创建配置模板 */
  async create(input: ConfigTemplateInput): Promise<ConfigTemplate> {
    const { data } = await api.post('/api/config-templates', input);
    return data.data;
  },

  /** 更新配置模板 */
  async update(id: string, input: ConfigTemplateInput): Promise<ConfigTemplate> {
    const { data } = await api.put(`/api/config-templates/${id}`, input);
    return data.data;
  },

  /** 删除配置模板 */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/config-templates/${id}`);
  },

  /** 渲染配置模板 */
  async render(id: string, variables?: Record<string, string>): Promise<RenderResult> {
    const { data } = await api.post(`/api/config-templates/${id}/render`, { variables });
    return data;
  },
};
