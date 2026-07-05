/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * Migration v048 — auto_scale_rules + auto_scale_history 表
 *
 * 从 modules/auto/services/autoScaleService.ensureTables() 下沉而来。
 * 自动伸缩规则与执行历史（不含运行时 startChecker 定时器，仅 schema）。
 */
const v048AutoScaleTables: Migration = {
  id: '20250101000048',
  version: 48,
  name: 'auto_scale_tables',
  description: 'Auto-scaling rules and history tables (migrated from autoScaleService.ensureTables)',

  up: async (db: any) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS auto_scale_rules (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        target_type TEXT NOT NULL, target_id TEXT NOT NULL, target_name TEXT,
        metric_type TEXT NOT NULL, threshold REAL NOT NULL, target_value REAL NOT NULL,
        min_instances INTEGER DEFAULT 1, max_instances INTEGER DEFAULT 10,
        scale_up_cooldown INTEGER DEFAULT 300, scale_down_cooldown INTEGER DEFAULT 600,
        enabled INTEGER DEFAULT 1, last_scale_time TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS auto_scale_history (
        id TEXT PRIMARY KEY, rule_id TEXT, rule_name TEXT,
        target_type TEXT, target_id TEXT,
        action TEXT, previous_count INTEGER, current_count INTEGER,
        metric_value REAL, result TEXT, reason TEXT,
        timestamp TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  },

  down: async (db: any) => {
    db.exec(`DROP TABLE IF EXISTS auto_scale_history`);
    db.exec(`DROP TABLE IF EXISTS auto_scale_rules`);
  },
};

export default v048AutoScaleTables;
