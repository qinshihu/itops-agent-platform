// backend/src/repositories/types/ai.ts
// 来源: v001 + v002 + v003 + v004 + v027 + v051 + v052

/** Agent — v001 agents + v002 ALTER + v004 ALTER */
export interface Agent {
  id: string;
  name: string;
  avatar: string | null;
  role: string | null;
  system_prompt: string | null;
  model: string;
  temperature: number;
  enabled: number;
  is_preset: number;
  category: string | null;
  tags: string | null;
  description: string | null;
  usage_count: number;
  last_used_at: string | null;
  api_provider: string;             // v002 ALTER
  primary_model_id: string | null;  // v004 ALTER
  fallback_model_id: string | null; // v004 ALTER
  created_at: string;
  updated_at: string;
}

/** Agent 执行记录 — v001 agent_executions */
export interface AgentExecution {
  id: string;
  agent_id: string;
  agent_name: string | null;
  input_text: string | null;
  output_text: string | null;
  status: string | null;
  error_message: string | null;
  execution_time_ms: number | null;
  token_count: number | null;
  metadata: string | null;
  created_at: string;
}

/** AI 模型 — v003 ai_models */
export interface AiModel {
  id: string;
  name: string;
  provider_type: string;
  api_key: string | null;
  api_base: string | null;
  model_id: string;
  enabled: number;
  sort_order: number;
  is_default: number;
  tags: string | null;
  last_test_status: string | null;
  last_test_time: string | null;
  created_at: string;
  updated_at: string;
}

/** 知识库 — v001 knowledge_base (被 v052 重新 CREATE) */
export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string | null;
  tags: string | null;
  solutions: string | null;
  source: string;
  alert_id: string | null;
  workflow_id: string | null;
  task_id: string | null;
  server_id: string | null;
  success_rating: number;
  duration_ms: number | null;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/** 根因分析 — v001 root_cause_analyses */
export interface RootCauseAnalysis {
  id: string;
  alert_id: string | null;
  title: string;
  description: string | null;
  status: string;
  root_cause: string | null;
  symptoms: string | null;
  timeline: string | null;
  evidence: string | null;
  recommendations: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Copilot 对话 — v001 copilot_conversations */
export interface CopilotConversation {
  id: string;
  user_id: string;
  messages: string;                  // JSON string
  created_at: string;
  updated_at: string;
}

/** AI 修复 — v027 ai_remediations + v051 ALTER (10 个新列) */
export interface AiRemediation {
  id: string;
  title: string;
  description: string;
  alert_id: string;
  status: string;
  strategy: string;
  result: string;
  device_id: string | null;
  device_name: string | null;
  device_ip: string | null;
  task_id: string | null;
  workflow_id: string | null;
  diagnosis: string | null;
  remediation_commands: string | null;
  risk_level: string | null;
  execution_result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
