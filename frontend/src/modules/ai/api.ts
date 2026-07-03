/**
 * AI 模块 API 服务层
 * 封装 AI 模型、Agent、根因分析、知识库、AI 修复相关端点
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── AI 模型 ──

export interface AIModel {
  id: string;
  name: string;
  provider_type: 'volcengine' | 'openai' | 'aliyun' | 'deepseek' | 'zhipu' | 'local';
  api_key?: string;
  api_base?: string;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags?: string[];
  last_test_status?: string;
  last_test_time?: string;
  created_at: string;
  updated_at: string;
}

export interface AIModelInput {
  name: string;
  provider_type: AIModel['provider_type'];
  model_id: string;
  api_key?: string | null;
  api_base?: string | null;
  use_global_config?: boolean;
  tags?: string[];
}

export interface AIModelUpdate {
  name?: string;
  provider_type?: AIModel['provider_type'];
  model_id?: string;
  api_key?: string | null;
  api_base?: string | null;
  enabled?: number;
  is_default?: number;
  tags?: string[];
}

// ── Agent ──

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: number;
  is_preset: number;
  category?: string;
  tags?: string[];
  description?: string;
  usage_count?: number;
  last_used_at?: string;
  primary_model_id?: string;
  fallback_model_id?: string;
  primary_model_name?: string;
  fallback_model_name?: string;
}

export interface AgentInput {
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: boolean;
  category?: string;
  description?: string;
  primary_model_id?: string;
  fallback_model_id?: string;
  tags?: string[];
}

export interface AgentListParams {
  category?: string;
  search?: string;
}

export interface AgentTestInput {
  input: string;
  serverIds?: string[];
}

export interface AgentTestResult {
  output: string;
  result?: string;
  [key: string]: unknown;
}

export interface AgentExecution {
  id: string;
  agent_id: string;
  agent_name: string;
  input_text: string;
  output_text: string;
  status: string;
  error_message?: string;
  execution_time_ms: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ── 根因分析 ──

export interface RootCauseAnalysis {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms: string[];
  timeline: Array<{ time: string; event: string }>;
  evidence: string[];
  recommendations: string[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface RcaInput {
  title: string;
  description?: string;
  alert_id?: string;
}

export interface RcaStats {
  [key: string]: unknown;
}

// ── 知识库 ──

export interface Knowledge {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  solutions: string[];
  usage_count: number;
  created_at: string;
}

export interface KnowledgeInput {
  title: string;
  category: string;
  tags: string[];
  content: string;
  solutions: string[];
}

export interface KnowledgeListParams {
  search?: string;
  category?: string;
}

// ── AI 修复 ──

export interface AiRemediation {
  id: string;
  [key: string]: unknown;
}

// ============================================================
// aiApi 对象
// ============================================================

export const aiApi = {
  // ── AI 模型 ──

  /** 获取 AI 模型列表 */
  async listModels(): Promise<AIModel[]> {
    const { data } = await api.get('/api/ai-models');
    return data.data;
  },

  /** 创建 AI 模型 */
  async createModel(input: AIModelInput): Promise<AIModel> {
    const { data } = await api.post('/api/ai-models', input);
    return data.data;
  },

  /** 更新 AI 模型 */
  async updateModel(id: string, input: AIModelUpdate): Promise<AIModel> {
    const { data } = await api.put(`/api/ai-models/${id}`, input);
    return data.data;
  },

  /** 删除 AI 模型 */
  async deleteModel(id: string): Promise<void> {
    await api.delete(`/api/ai-models/${id}`);
  },

  /** 切换模型启用状态 */
  async toggleModel(id: string, enabled: boolean): Promise<AIModel> {
    const { data } = await api.put(`/api/ai-models/${id}`, { enabled: enabled ? 1 : 0 });
    return data.data;
  },

  /** 设置默认模型 */
  async setDefaultModel(id: string): Promise<AIModel> {
    const { data } = await api.put(`/api/ai-models/${id}`, { is_default: 1 });
    return data.data;
  },

  /** 模型排序 */
  async reorderModels(modelIds: string[]): Promise<void> {
    await api.put('/api/ai-models/reorder', { modelIds });
  },

  /** 测试模型连接 */
  async testModel(id: string): Promise<unknown> {
    const { data } = await api.post(`/api/ai-models/${id}/test`);
    return data;
  },

  // ── Agent ──

  /** 获取 Agent 列表 */
  async listAgents(params?: AgentListParams): Promise<Agent[]> {
    const { data } = await api.get('/api/agents', { params });
    return data.data;
  },

  /** 获取 Agent 详情 */
  async getAgent(id: string): Promise<Agent> {
    const { data } = await api.get(`/api/agents/${id}`);
    return data.data;
  },

  /** 创建 Agent */
  async createAgent(input: AgentInput): Promise<Agent> {
    const { data } = await api.post('/api/agents', input);
    return data.data;
  },

  /** 更新 Agent */
  async updateAgent(id: string, input: Partial<AgentInput>): Promise<Agent> {
    const { data } = await api.put(`/api/agents/${id}`, input);
    return data.data;
  },

  /** 删除 Agent */
  async deleteAgent(id: string): Promise<void> {
    await api.delete(`/api/agents/${id}`);
  },

  /** 测试 Agent */
  async testAgent(id: string, input: AgentTestInput): Promise<AgentTestResult> {
    const { data } = await api.post(`/api/agents/${id}/test`, input);
    return data.data;
  },

  /** 获取 Agent 执行历史 */
  async listAgentExecutions(id: string, params?: { limit?: number }): Promise<AgentExecution[]> {
    const { data } = await api.get(`/api/agents/${id}/executions`, { params });
    return data.data;
  },

  // ── 根因分析 ──

  /** 获取根因分析列表 */
  async listRcas(): Promise<RootCauseAnalysis[]> {
    const { data } = await api.get('/api/root-cause-analysis');
    return data.data || [];
  },

  /** 获取根因分析详情 */
  async getRca(id: string): Promise<RootCauseAnalysis> {
    const { data } = await api.get(`/api/root-cause-analysis/${id}`);
    return data.data;
  },

  /** 创建根因分析 */
  async createRca(input: RcaInput): Promise<RootCauseAnalysis> {
    const { data } = await api.post('/api/root-cause-analysis', input);
    return data.data;
  },

  /** 执行根因分析 */
  async analyzeRca(id: string): Promise<unknown> {
    const { data } = await api.post(`/api/root-cause-analysis/${id}/analyze`);
    return data;
  },

  /** 删除根因分析 */
  async deleteRca(id: string): Promise<void> {
    await api.delete(`/api/root-cause-analysis/${id}`);
  },

  /** 自动分析告警根因 */
  async autoAnalyzeAlert(alertId: string): Promise<void> {
    await api.post(`/api/root-cause-analysis/auto-analyze/${alertId}`);
  },

  /** 获取根因分析统计 */
  async getRcaStats(): Promise<RcaStats> {
    const { data } = await api.get('/api/root-cause-analysis/stats');
    return data.data;
  },

  // ── 知识库 ──

  /** 获取知识库列表 */
  async listKnowledge(params?: KnowledgeListParams): Promise<Knowledge[]> {
    const { data } = await api.get('/api/knowledge', { params });
    return data.data;
  },

  /** 创建知识条目 */
  async createKnowledge(input: KnowledgeInput): Promise<Knowledge> {
    const { data } = await api.post('/api/knowledge', input);
    return data.data;
  },

  /** 更新知识条目 */
  async updateKnowledge(id: string, input: KnowledgeInput): Promise<Knowledge> {
    const { data } = await api.put(`/api/knowledge/${id}`, input);
    return data.data;
  },

  /** 删除知识条目 */
  async deleteKnowledge(id: string): Promise<void> {
    await api.delete(`/api/knowledge/${id}`);
  },

  // ── AI 修复 ──

  /** 获取 AI 修复列表 */
  async listAiRemediations(params?: { limit?: number }): Promise<AiRemediation[]> {
    const { data } = await api.get('/api/ai-remediations', { params });
    return data.data || [];
  },
};

export default aiApi;
