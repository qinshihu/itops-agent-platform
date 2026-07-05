/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v042 — baseline_metrics 表
 *
 * 从 alertAutoResponseService.ensureTables() 下沉而来。
 * aars_response_logs / aars_config 已由 v018 建立；
 * 本版本补建 baseline_metrics（基线指标采样表，AARS 自适应学习使用）。
 */
const v042BaselineMetrics: Migration = {
  id: '20250101000042',
  version: 42,
  name: 'baseline_metrics',
  description: 'AARS baseline metrics sampling table (migrated from alertAutoResponseService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS baseline_metrics (
        device_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        sample_value REAL NOT NULL,
        sampled_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        PRIMARY KEY (device_id, metric_name, sampled_at)
      )
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS baseline_metrics`);
  },
};

export default v042BaselineMetrics;
