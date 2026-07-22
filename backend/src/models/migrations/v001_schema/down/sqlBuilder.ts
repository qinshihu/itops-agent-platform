/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Down SQL Builder
 *
 * 拆解自 v001_initial_schema.ts 原 L816-L859（down() 内的 db.exec(`...`））。
 *
 * ⚠️ 2026-07-21 v2.31 ADR-034 B 模式拆分：
 *   - 字节级保持原 SQL 字符串字面量内容不变
 *   - DROP TABLE 顺序严格保留（外键约束有依赖）
 *   - 返回单字符串，调用方用 db.exec() 单次执行
 *
 * @see backend/src/models/migrations/v001_initial_schema.ts
 * @see .trae/adr/034-v001-migration-splitting.md
 */

export function buildDownSql(): string {
  return `
      DROP TABLE IF EXISTS network_inspection_history;
      DROP TABLE IF EXISTS network_devices;
      DROP TABLE IF EXISTS server_metrics;
      DROP TABLE IF EXISTS remediation_cooldowns;
      DROP TABLE IF EXISTS remediation_audits;
      DROP TABLE IF EXISTS remediation_history;
      DROP TABLE IF EXISTS remediation_executions;
      DROP TABLE IF EXISTS remediation_policies;
      DROP TABLE IF EXISTS change_records;
      DROP TABLE IF EXISTS service_topologies;
      DROP TABLE IF EXISTS alert_notifications;
      DROP TABLE IF EXISTS alert_configs;
      DROP TABLE IF EXISTS copilot_conversations;
      DROP TABLE IF EXISTS root_cause_analyses;
      DROP TABLE IF EXISTS notification_configs;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS settings;
      DROP TABLE IF EXISTS scheduled_tasks;
      DROP TABLE IF EXISTS report_schedules;
      DROP TABLE IF EXISTS reports;
      DROP TABLE IF EXISTS scripts;
      DROP TABLE IF EXISTS knowledge_base;
      DROP TABLE IF EXISTS alert_workflow_mappings;
      DROP TABLE IF EXISTS alert_noise_reduction;
      DROP TABLE IF EXISTS alert_webhook_logs;
      DROP TABLE IF EXISTS alerts;
      DROP TABLE IF EXISTS tasks;
      DROP TABLE IF EXISTS workflows;
      DROP TABLE IF EXISTS agent_executions;
      DROP TABLE IF EXISTS agents;
      DROP TABLE IF EXISTS encryption_keys;
      DROP TABLE IF EXISTS compliance_checks;
      DROP TABLE IF EXISTS server_command_history;
      DROP TABLE IF EXISTS server_group_mapping;
      DROP TABLE IF EXISTS server_groups;
      DROP TABLE IF EXISTS ssh_keys;
      DROP TABLE IF EXISTS servers;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS token_blacklist;
    `;
}
