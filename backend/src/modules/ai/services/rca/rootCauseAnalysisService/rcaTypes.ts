import type { Statement } from 'better-sqlite3';

export type StatementNoParams = Statement<[]>;

export interface RootCauseAnalysis {
  id: string;
  alert_id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string; // JSON array
  timeline?: string; // JSON array
  evidence?: string; // JSON array
  recommendations?: string; // JSON array
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreateRCAInput {
  alert_id?: string;
  title: string;
  description?: string;
}

export interface UpdateRCAInput {
  title?: string;
  description?: string;
  status?: 'pending' | 'analyzing' | 'completed' | 'failed';
  root_cause?: string;
  symptoms?: string[];
  timeline?: Array<{ time: string; event: string }>;
  evidence?: string[];
  recommendations?: string[];
}