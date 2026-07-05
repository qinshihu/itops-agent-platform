/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: any[];
  edges: any[];
  is_template: number;
  created_at: string;
  updated_at?: string;
}

export interface Server {
  id: string;
  name: string;
  hostname: string;
}