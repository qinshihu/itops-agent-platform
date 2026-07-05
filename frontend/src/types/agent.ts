// frontend/src/types/agent.ts
// 与后端 backend/src/repositories/types/ai.ts 对应

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
  api_provider: string;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  created_at: string;
  updated_at: string;
}

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
  created_at: string;
}
