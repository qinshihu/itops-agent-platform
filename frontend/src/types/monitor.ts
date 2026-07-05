// frontend/src/types/monitor.ts
// 与后端 backend/src/repositories/types/monitor.ts 对应

export interface BaselineMetric {
  device_id: string;
  metric_name: string;
  sample_value: number;
  sampled_at: string;
}

export interface Dashboard {
  id: string;
  name: string;
  type: string;
  config: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  period: string;
  status: string;
  created_at: string;
}

export interface CostEntry {
  id: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  created_at: string;
}
