import type { Node, Edge } from '@xyflow/react';

export interface WorkflowNodeData extends Record<string, unknown> {
  label?: string;
  [key: string]: unknown;
}

export type WorkflowNode = Node<WorkflowNodeData>;
export type WorkflowEdge = Edge;

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  is_template: number;
  created_at: string;
  updated_at?: string;
}

export interface Server {
  id: string;
  name: string;
  hostname: string;
}
