/**
 * Tool-links 模块 API 服务层
 *
 * 从原 frontend infra/ 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 */

import api from '@/lib/api';

// ── 类型定义 ──

export interface ToolLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  image_icon: string | null;
  category: string;
  description: string | null;
  sort_order: number;
  is_external: number;
}

export interface ToolLinkInput {
  name: string;
  url: string;
  icon: string;
  category: string;
  description?: string;
  sort_order: number;
  is_external: boolean;
}

export interface ToolLinkCategory {
  category: string;
  tools: ToolLink[];
}

// ── API 对象 ──

export const toolLinksApi = {
  /** 获取工具链接分类分组 */
  async listToolLinkCategories(): Promise<ToolLinkCategory[]> {
    const { data } = await api.get('/tool-links/categories');
    return data;
  },

  /** 获取工具链接列表 */
  async listToolLinks(): Promise<ToolLink[]> {
    const { data } = await api.get('/tool-links');
    return data;
  },

  /** 创建工具链接 */
  async createToolLink(input: ToolLinkInput): Promise<ToolLink> {
    const { data } = await api.post('/tool-links', input);
    return data;
  },

  /** 更新工具链接 */
  async updateToolLink(id: string, input: Partial<ToolLinkInput>): Promise<ToolLink> {
    const { data } = await api.put(`/tool-links/${id}`, input);
    return data;
  },

  /** 删除工具链接 */
  async deleteToolLink(id: string): Promise<void> {
    await api.delete(`/tool-links/${id}`);
  },

  /** 上传工具链接图标 */
  async uploadToolLinkIcon(id: string, formData: FormData): Promise<ToolLink> {
    const { data } = await api.post(`/tool-links/${id}/upload-icon`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /** 删除工具链接图标 */
  async deleteToolLinkIcon(id: string): Promise<void> {
    await api.delete(`/tool-links/${id}/icon`);
  },
};

export default toolLinksApi;
