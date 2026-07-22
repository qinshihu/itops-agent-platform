/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Chunk 3 of 5
 *
 * 行数: 130
 * 起始: Alert Workflow Mappings
 */

export function upChunk3(): string {
  return `
      -- Alert Workflow Mappings
      CREATE TABLE IF NOT EXISTS alert_workflow_mappings (
        id TEXT PRIMARY KEY,
        alert_source TEXT,
        alert_severity TEXT,
        alert_title_pattern TEXT,
        workflow_id TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_mapping_enabled ON alert_workflow_mappings(enabled);

      -- Knowledge Base
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT,
        content TEXT NOT NULL,
        tags TEXT,
        solutions TEXT,
        related_alerts TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base(category);
      CREATE INDEX IF NOT EXISTS idx_kb_usage ON knowledge_base(usage_count);

      -- Scripts
      CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        language TEXT DEFAULT 'bash',
        content TEXT NOT NULL,
        tags TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
      CREATE INDEX IF NOT EXISTS idx_scripts_name ON scripts(name);

      -- Reports
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'generated',
        content TEXT,
        format TEXT DEFAULT 'markdown',
        template_id TEXT,
        task_id TEXT,
        variables TEXT,
        metadata TEXT,
        is_preset INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
      CREATE INDEX IF NOT EXISTS idx_reports_task_id ON reports(task_id);
      CREATE INDEX IF NOT EXISTS idx_reports_template_id ON reports(template_id);
      CREATE INDEX IF NOT EXISTS idx_reports_is_preset ON reports(is_preset);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

      -- Report Schedules
      CREATE TABLE IF NOT EXISTS report_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template_id TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        recipients TEXT,
        format TEXT DEFAULT 'markdown',
        last_generated DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (template_id) REFERENCES reports(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_report_schedules_enabled ON report_schedules(enabled);
      CREATE INDEX IF NOT EXISTS idx_report_schedules_template ON report_schedules(template_id);

      -- Scheduled Tasks
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        workflow_id TEXT NOT NULL,
        schedule TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        last_run DATETIME,
        next_run DATETIME,
        last_status TEXT DEFAULT 'unknown',
        context TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_scheduled_enabled ON scheduled_tasks(enabled);

      -- Settings
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);

    `;
}
