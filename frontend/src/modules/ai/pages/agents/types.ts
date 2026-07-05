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

export interface AIModel {
  id: string;
  name: string;
  provider_type: string;
  model_id: string;
  enabled: number;
}

export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  enabled: number;
}

export interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  host: string;
  port: number;
  username: string;
  database: string;
  description?: string;
  enabled: number;
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

export interface AgentDetailInnerProps {
  agentId: string;
  onBack: () => void;
  deleteMutation: { mutate: (id: string) => void };
}