/**
 * Scripts 模块 API 服务层
 *
 * 从原 frontend infra/ 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 */

import api from '@/lib/api';

// ── 类型定义 ──

export interface ScriptParameter {
  name: string;
  description: string;
  required: boolean;
}

export interface Script {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  parameters: ScriptParameter[];
  category: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ScriptInput {
  name: string;
  description?: string;
  type: string;
  content: string;
  parameters: ScriptParameter[];
  category: string;
}

export interface ScriptListParams {
  search?: string;
  category?: string;
}

// ── API 对象 ──

export const scriptsApi = {
  /** 获取脚本列表 */
  async listScripts(params?: ScriptListParams): Promise<Script[]> {
    const { data } = await api.get('/scripts', { params });
    return data;
  },

  /** 获取脚本分类 */
  async listScriptCategories(): Promise<string[]> {
    const { data } = await api.get('/scripts/categories');
    return data;
  },

  /** 创建脚本 */
  async createScript(input: ScriptInput): Promise<Script> {
    const { data } = await api.post('/scripts', input);
    return data;
  },

  /** 更新脚本 */
  async updateScript(id: string, input: ScriptInput): Promise<Script> {
    const { data } = await api.put(`/scripts/${id}`, input);
    return data;
  },

  /** 删除脚本 */
  async deleteScript(id: string): Promise<void> {
    await api.delete(`/scripts/${id}`);
  },
};

export default scriptsApi;
