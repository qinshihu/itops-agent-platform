/**
 * AI 妯″潡 API 鏈嶅姟灞?
 * 灏佽 AI 妯″瀷銆丄gent銆佹牴鍥犲垎鏋愩€佺煡璇嗗簱銆丄I 淇鐩稿叧绔偣
 */

import api from '@/lib/api';
import type { Agent as _AgentEntity, AiModel as _AiModel } from '../../types/agent';

// ============================================================
// 绫诲瀷瀹氫箟
// ============================================================

// 鈹€鈹€ AI 妯″瀷 鈹€鈹€

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

// 鈹€鈹€ Agent 鈹€鈹€

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
  serverId?: string;
  databaseId?: string;
  context?: Record<string, unknown>;
}

export interface AgentTestResult {
  executionId: string;
  output: string;
  status: string;
  executionTime: number;
  metadata: {
    serverId?: string;
    databaseId?: string;
  };
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

export interface AgentExecutionsResponse {
  executions: AgentExecution[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface AgentStatsSummary {
  totalAgents: number;
  enabledAgents: number;
  presetAgents: number;
  totalExecutions: number;
  categoryStats: Array<{ category: string | null; count: number }>;
}

export interface AgentTestInputSuggestion {
  testInput: string;
  agentName: string;
}

export interface AgentImportResult {
  importedCount: number;
  ids: string[];
}

export interface AgentExportData {
  name: string;
  avatar: string;
  role: string;
  system_prompt: string;
  model: string;
  temperature: number;
  enabled: number;
  category?: string | null;
  tags: string[];
  description?: string | null;
  api_provider?: string;
  primary_model_id?: string | null;
  fallback_model_id?: string | null;
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: string;
  schema: Record<string, unknown>;
}

export interface AgentToolTestResult {
  toolId: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface AgentToolDescriptions {
  description: string;
}

// 鈹€鈹€ 鏍瑰洜鍒嗘瀽 鈹€鈹€

export interface RcaJobStatus {
  id: string;
  rcaId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
}

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

// 鈹€鈹€ 鐭ヨ瘑搴?鈹€鈹€

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

// 鈹€鈹€ AI 淇 鈹€鈹€

export interface AiRemediation {
  id: string;
  [key: string]: unknown;
}

export interface AiRemediationStats {
  total: number;
  byStatus: Record<string, number>;
  mttrSeconds: number | null;
  mttrCount: number;
  successRate: number;
  completedThisWeek: number;
  completedLastWeek: number;
  weekOverWeekDelta: number;
  noiseFilter: { autoHandled: number; total: number; rate: number };
  mttrMinutes: number | null;
  mttrDisplay: string | null;
}

// ============================================================
// aiApi 瀵硅薄
// ============================================================

export const aiApi = {
  // 鈹€鈹€ AI 妯″瀷 鈹€鈹€

  /** 鑾峰彇 AI 妯″瀷鍒楄〃 */
  async listModels(): Promise<AIModel[]> {
    const { data } = await api.get('/ai-models');
    return data;
  },

  /** 鍒涘缓 AI 妯″瀷 */
  async createModel(input: AIModelInput): Promise<AIModel> {
    const { data } = await api.post('/ai-models', input);
    return data;
  },

  /** 鏇存柊 AI 妯″瀷 */
  async updateModel(id: string, input: AIModelUpdate): Promise<AIModel> {
    const { data } = await api.put(`/ai-models/${id}`, input);
    return data;
  },

  /** 鍒犻櫎 AI 妯″瀷 */
  async deleteModel(id: string): Promise<void> {
    await api.delete(`/ai-models/${id}`);
  },

  /** 鍒囨崲妯″瀷鍚敤鐘舵€?*/
  async toggleModel(id: string, enabled: boolean): Promise<AIModel> {
    const { data } = await api.put(`/ai-models/${id}`, { enabled: enabled ? 1 : 0 });
    return data;
  },

  /** 璁剧疆榛樿妯″瀷 */
  async setDefaultModel(id: string): Promise<AIModel> {
    const { data } = await api.put(`/ai-models/${id}`, { is_default: 1 });
    return data;
  },

  /** 妯″瀷鎺掑簭 */
  async reorderModels(modelIds: string[]): Promise<void> {
    await api.put('/ai-models/reorder', { modelIds });
  },

  /** 娴嬭瘯妯″瀷杩炴帴 */
  async testModel(id: string): Promise<unknown> {
    const { data } = await api.post(`/ai-models/${id}/test`);
    return data;
  },

  // 鈹€鈹€ Agent 鈹€鈹€

  /** 鑾峰彇 Agent 鍒楄〃 */
  async listAgents(params?: AgentListParams): Promise<Agent[]> {
    const { data } = await api.get('/agents', { params });
    return data;
  },

  /** 鑾峰彇 Agent 璇︽儏 */
  async getAgent(id: string): Promise<Agent> {
    const { data } = await api.get(`/agents/${id}`);
    return data;
  },

  /** 鍒涘缓 Agent */
  async createAgent(input: AgentInput): Promise<Agent> {
    const { data } = await api.post('/agents', input);
    return data;
  },

  /** 鏇存柊 Agent */
  async updateAgent(id: string, input: Partial<AgentInput>): Promise<Agent> {
    const { data } = await api.put(`/agents/${id}`, input);
    return data;
  },

  /** 鍒犻櫎 Agent */
  async deleteAgent(id: string): Promise<void> {
    await api.delete(`/agents/${id}`);
  },

  /** 娴嬭瘯 Agent */
  async testAgent(id: string, input: AgentTestInput): Promise<AgentTestResult> {
    const { data } = await api.post(`/agents/${id}/test`, input);
    return data;
  },

  /** 鑾峰彇 Agent 鎵ц鍘嗗彶 */
  async listAgentExecutions(
    id: string,
    params?: { limit?: number; offset?: number; status?: string },
  ): Promise<AgentExecutionsResponse> {
    const { data } = await api.get(`/agents/${id}/executions`, { params });
    return data;
  },

  /** 鑾峰彇 Agent 缁熻姒傝 */
  async getAgentStatsSummary(): Promise<AgentStatsSummary> {
    const { data } = await api.get('/agents/stats/summary');
    return data;
  },

  /** 鑾峰彇 Agent 鎺ㄨ崘娴嬭瘯杈撳叆 */
  async getAgentTestInput(id: string): Promise<AgentTestInputSuggestion> {
    const { data } = await api.get(`/agents/${id}/test-input`);
    return data;
  },

  /** 鎵归噺瀵煎叆 Agent */
  async importAgents(agents: AgentInput[]): Promise<AgentImportResult> {
    const { data } = await api.post('/agents/import', { agents });
    return data;
  },

  /** 瀵煎嚭鍗曚釜 Agent 閰嶇疆 */
  async exportAgent(id: string): Promise<AgentExportData> {
    const { data } = await api.get(`/agents/export/${id}`);
    return data;
  },

  /** 鑾峰彇宸ュ叿鍒楄〃 */
  async listAgentTools(category?: string): Promise<AgentTool[]> {
    const { data } = await api.get('/agents/tools/list', {
      params: category ? { category } : undefined,
    });
    return data;
  },

  /** 娴嬭瘯宸ュ叿鎵ц */
  async testAgentTool(
    toolId: string,
    args?: Record<string, unknown>,
  ): Promise<AgentToolTestResult> {
    const { data } = await api.post('/agents/tools/test', { toolId, args });
    return data;
  },

  /** 鑾峰彇宸ュ叿鎻忚堪锛堢粰 LLM 鐢級 */
  async getAgentToolDescriptions(): Promise<AgentToolDescriptions> {
    const { data } = await api.get('/agents/tools/descriptions');
    return data;
  },

  // 鈹€鈹€ 鏍瑰洜鍒嗘瀽 鈹€鈹€

  /** 鑾峰彇鏍瑰洜鍒嗘瀽鍒楄〃 */
  async listRcas(): Promise<RootCauseAnalysis[]> {
    const { data } = await api.get('/root-cause-analysis');
    return data || [];
  },

  /** 鑾峰彇鏍瑰洜鍒嗘瀽璇︽儏 */
  async getRca(id: string): Promise<RootCauseAnalysis> {
    const { data } = await api.get(`/root-cause-analysis/${id}`);
    return data;
  },

  /** 鍒涘缓鏍瑰洜鍒嗘瀽 */
  async createRca(input: RcaInput): Promise<RootCauseAnalysis> {
    const { data } = await api.post('/root-cause-analysis', input);
    return data;
  },

  /** 鎵ц鏍瑰洜鍒嗘瀽锛堝悓姝ワ紝鍙兘瓒呮椂锛?*/
  async analyzeRca(id: string): Promise<unknown> {
    const { data } = await api.post(`/root-cause-analysis/${id}/analyze`);
    return data;
  },

  /** v4 鏂板锛氬紓姝ユ墽琛屾牴鍥犲垎鏋愶紙绔嬪嵆杩斿洖 jobId锛?*/
  async analyzeRcaAsync(
    id: string,
  ): Promise<{ jobId: string; rcaId: string; status: string; pollUrl: string }> {
    const { data } = await api.post(`/root-cause-analysis/${id}/analyze-async`);
    return data;
  },

  /** v4 鏂板锛氳疆璇㈠紓姝ヤ换鍔＄姸鎬?*/
  async getRcaJobStatus(jobId: string): Promise<RcaJobStatus> {
    const { data } = await api.get(`/root-cause-analysis/jobs/${jobId}`);
    return data;
  },

  /** 鍒犻櫎鏍瑰洜鍒嗘瀽 */
  async deleteRca(id: string): Promise<void> {
    await api.delete(`/root-cause-analysis/${id}`);
  },

  /** 鑷姩鍒嗘瀽鍛婅鏍瑰洜 */
  async autoAnalyzeAlert(alertId: string): Promise<void> {
    await api.post(`/root-cause-analysis/auto-analyze/${alertId}`);
  },

  /** 鑾峰彇鏍瑰洜鍒嗘瀽缁熻 */
  async getRcaStats(): Promise<RcaStats> {
    const { data } = await api.get('/root-cause-analysis/stats');
    return data;
  },

  // 鈹€鈹€ 鐭ヨ瘑搴?鈹€鈹€

  /** 鑾峰彇鐭ヨ瘑搴撳垪琛?*/
  async listKnowledge(params?: KnowledgeListParams): Promise<Knowledge[]> {
    const { data } = await api.get('/knowledge', { params });
    return data;
  },

  /** 鍒涘缓鐭ヨ瘑鏉＄洰 */
  async createKnowledge(input: KnowledgeInput): Promise<Knowledge> {
    const { data } = await api.post('/knowledge', input);
    return data;
  },

  /** 鏇存柊鐭ヨ瘑鏉＄洰 */
  async updateKnowledge(id: string, input: KnowledgeInput): Promise<Knowledge> {
    const { data } = await api.put(`/knowledge/${id}`, input);
    return data;
  },

  /** 鍒犻櫎鐭ヨ瘑鏉＄洰 */
  async deleteKnowledge(id: string): Promise<void> {
    await api.delete(`/knowledge/${id}`);
  },

  // 鈹€鈹€ AI 淇 鈹€鈹€

  /** AI 淇鐪熷疄缁熻锛圡TTR / 鎴愬姛鐜?/ 闄嶅櫔鐜?/ 瓒嬪娍锛?*/
  async getAiRemediationStats(): Promise<AiRemediationStats> {
    const { data } = await api.get('/ai-remediations/stats');
    return data;
  },

  /** 鑾峰彇 AI 淇鍒楄〃 */
  async listAiRemediations(params?: { limit?: number }): Promise<AiRemediation[]> {
    const { data } = await api.get('/ai-remediations', { params });
    return data || [];
  },

  /** 鑾峰彇 AI 淇璇︽儏 */
  async getAiRemediation(id: string): Promise<AiRemediation> {
    const { data } = await api.get(`/ai-remediations/${id}`);
    return data;
  },

  /** 鎵瑰噯 AI 淇锛堜粎 waiting_approval 鐘舵€佸彲鐢級 */
  async approveAiRemediation(id: string, comment?: string): Promise<AiRemediation> {
    const { data } = await api.post(`/ai-remediations/${id}/approve`, { comment });
    return data;
  },

  /** 鎷掔粷 AI 淇锛堜粎 waiting_approval 鐘舵€佸彲鐢級 */
  async rejectAiRemediation(id: string, comment?: string): Promise<AiRemediation> {
    const { data } = await api.post(`/ai-remediations/${id}/reject`, { comment });
    return data;
  },
};

export default aiApi;

