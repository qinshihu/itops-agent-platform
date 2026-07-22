/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Chunk 2 of 5
 *
 * 行数: 161
 * 起始: Encryption Keys
 */

export function upChunk2(): string {
  return `
      -- Encryption Keys
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id TEXT PRIMARY KEY,
        key_type TEXT NOT NULL,
        key_value TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        active INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_encryption_active ON encryption_keys(active);

      -- Agents
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT,
        role TEXT,
        system_prompt TEXT,
        model TEXT DEFAULT 'doubao-4o',
        temperature REAL DEFAULT 0.7,
        enabled INTEGER DEFAULT 1,
        is_preset INTEGER DEFAULT 0,
        category TEXT,
        tags TEXT,
        description TEXT,
        usage_count INTEGER DEFAULT 0,
        last_used_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
      CREATE INDEX IF NOT EXISTS idx_agents_is_preset ON agents(is_preset);
      CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
      CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count);

      -- Agent Executions
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        agent_name TEXT,
        input_text TEXT,
        output_text TEXT,
        status TEXT,
        error_message TEXT,
        execution_time_ms INTEGER,
        token_count INTEGER,
        metadata TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_created ON agent_executions(agent_id, created_at DESC);

      -- Workflows
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        nodes TEXT,
        edges TEXT,
        agent_configs TEXT,
        is_template INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_template_created ON workflows(is_template DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workflows_name ON workflows(name);
      CREATE INDEX IF NOT EXISTS idx_workflows_is_template ON workflows(is_template);

      -- Tasks
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        name TEXT,
        status TEXT DEFAULT 'pending',
        start_time DATETIME,
        end_time DATETIME,
        current_node_id TEXT,
        node_results TEXT,
        logs TEXT,
        context TEXT,
        metrics TEXT,
        execution_order TEXT,
        report_id TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_workflow_status ON tasks(workflow_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_report ON tasks(report_id);

      -- Alerts
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        metadata TEXT,
        related_task_id TEXT,
        status TEXT DEFAULT 'new',
        alert_fingerprint TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
      CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_alerts_source_created ON alerts(source, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON alerts(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_task ON alerts(related_task_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_title ON alerts(title);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint_unique ON alerts(alert_fingerprint) WHERE alert_fingerprint IS NOT NULL;

      -- Alert Webhook Logs
      CREATE TABLE IF NOT EXISTS alert_webhook_logs (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        status TEXT NOT NULL,
        alert_count INTEGER DEFAULT 0,
        resolved_count INTEGER DEFAULT 0,
        error_message TEXT,
        request_body TEXT,
        ip_address TEXT,
        user_agent TEXT,
        processing_time_ms INTEGER,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON alert_webhook_logs(source);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON alert_webhook_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON alert_webhook_logs(status);
      CREATE INDEX IF NOT EXISTS idx_webhook_logs_source_created ON alert_webhook_logs(source, created_at DESC);

      -- Alert Noise Reduction
      CREATE TABLE IF NOT EXISTS alert_noise_reduction (
        id TEXT PRIMARY KEY,
        alert_fingerprint TEXT NOT NULL UNIQUE,
        alert_source TEXT NOT NULL,
        alert_title TEXT NOT NULL,
        occurrence_count INTEGER DEFAULT 1,
        first_occurrence DATETIME NOT NULL,
        last_occurrence DATETIME NOT NULL,
        is_suppressed INTEGER DEFAULT 0,
        suppression_reason TEXT,
        suppression_until DATETIME
      );

      CREATE INDEX IF NOT EXISTS idx_noise_reduction_fingerprint ON alert_noise_reduction(alert_fingerprint);
      CREATE INDEX IF NOT EXISTS idx_noise_reduction_suppressed ON alert_noise_reduction(is_suppressed);
      CREATE INDEX IF NOT EXISTS idx_noise_reduction_last_occurrence ON alert_noise_reduction(last_occurrence DESC);

    `;
}
