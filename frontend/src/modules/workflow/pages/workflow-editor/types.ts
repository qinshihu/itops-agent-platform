import type { Edge, Node } from '@xyflow/react';

export interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  model: string;
  temperature: number;
  enabled: number;
  system_prompt?: string;
  description?: string;
}

export interface WorkflowData {
  id?: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  is_template?: number;
}

export interface AgentNodeData {
  label?: string;
  avatar?: string;
  description?: string;
  inputKey?: string;
  outputKey?: string;
  prompt?: string;
  agentId?: string;
}

export interface ApprovalNodeData {
  label?: string;
  description?: string;
  approvalConfig?: {
    description?: string;
    timeout?: number;
    timeoutAction?: string;
    approvers?: string[];
  };
}

export interface ProviderNodeData {
  label?: string;
  description?: string;
  providerId?: string;
  providerName?: string;
  providerType?: string;
  configSchema?: {
    properties?: Record<string, { title?: string; description?: string; type?: string; enum?: string[]; default?: string }>;
  } | null;
  method?: string;
  config?: Record<string, unknown>;
}

export interface GenericNodeData {
  label?: string;
  [key: string]: unknown;
}

export type NodeData = AgentNodeData | ApprovalNodeData | ProviderNodeData | GenericNodeData;

export interface Provider {
  id: string;
  name: string;
  type: string;
  configSchema: Record<string, unknown> | null;
}