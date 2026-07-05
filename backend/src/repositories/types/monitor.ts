// backend/src/repositories/types/monitor.ts
// 来源: v042 (baseline_metrics)

export interface BaselineMetric {
  device_id: string;
  metric_name: string;
  sample_value: number;
  sampled_at: string;
}
