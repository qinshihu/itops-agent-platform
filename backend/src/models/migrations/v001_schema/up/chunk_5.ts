/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Chunk 5 of 5
 *
 * 行数: 194
 * 起始: Remediation Policies
 */

export function upChunk5(): string {
  return `
      -- Remediation Policies
      CREATE TABLE IF NOT EXISTS remediation_policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        alert_source TEXT NOT NULL,
        alert_severity TEXT,
        alert_keywords TEXT,
        alert_tags TEXT,
        execution_mode TEXT NOT NULL DEFAULT 'approval',
        workflow_id TEXT,
        workflow_params TEXT,
        max_executions_per_hour INTEGER DEFAULT 5,
        cooldown_seconds INTEGER DEFAULT 300,
        require_confirmation TEXT,
        enable_verification INTEGER DEFAULT 1,
        verification_workflow_id TEXT,
        verification_params TEXT,
        verification_timeout_seconds INTEGER DEFAULT 120,
        enable_rollback INTEGER DEFAULT 1,
        rollback_workflow_id TEXT,
        rollback_on_failure INTEGER DEFAULT 1,
        enabled INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_remediation_policies_alert_source ON remediation_policies(alert_source);
      CREATE INDEX IF NOT EXISTS idx_remediation_policies_enabled ON remediation_policies(enabled);
      CREATE INDEX IF NOT EXISTS idx_remediation_policies_execution_mode ON remediation_policies(execution_mode);

      -- Remediation Executions
      CREATE TABLE IF NOT EXISTS remediation_executions (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        alert_snapshot TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        status_reason TEXT,
        approval_required INTEGER DEFAULT 0,
        approved_by TEXT,
        approved_at DATETIME,
        approval_comment TEXT,
        workflow_execution_id TEXT,
        started_at DATETIME,
        completed_at DATETIME,
        execution_result TEXT,
        verification_status TEXT,
        verification_result TEXT,
        verification_completed_at DATETIME,
        rollback_triggered INTEGER DEFAULT 0,
        rollback_execution_id TEXT,
        rollback_completed_at DATETIME,
        rollback_result TEXT,
        execution_duration_ms INTEGER,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (policy_id) REFERENCES remediation_policies(id),
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_remediation_executions_policy ON remediation_executions(policy_id);
      CREATE INDEX IF NOT EXISTS idx_remediation_executions_alert ON remediation_executions(alert_id);
      CREATE INDEX IF NOT EXISTS idx_remediation_executions_status ON remediation_executions(status);
      CREATE INDEX IF NOT EXISTS idx_remediation_executions_created ON remediation_executions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_remediation_exec_policy_status ON remediation_executions(policy_id, status);
      CREATE INDEX IF NOT EXISTS idx_remediation_exec_workflow ON remediation_executions(workflow_execution_id);

      -- Remediation History
      CREATE TABLE IF NOT EXISTS remediation_history (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        alert_source TEXT,
        alert_severity TEXT,
        execution_status TEXT,
        root_cause TEXT,
        resolution TEXT,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (policy_id) REFERENCES remediation_policies(id)
      );

      CREATE INDEX IF NOT EXISTS idx_remediation_history_policy ON remediation_history(policy_id);
      CREATE INDEX IF NOT EXISTS idx_remediation_history_status ON remediation_history(execution_status);
      CREATE INDEX IF NOT EXISTS idx_remediation_history_policy_status ON remediation_history(policy_id, execution_status);

      -- Remediation Audits
      CREATE TABLE IF NOT EXISTS remediation_audits (
        id TEXT PRIMARY KEY,
        rca_id TEXT NOT NULL,
        policy_id TEXT,
        server_id TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        approved_by TEXT,
        approved_at TEXT,
        execution_log TEXT,
        result TEXT,
        is_rollback INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        FOREIGN KEY (rca_id) REFERENCES root_cause_analyses(id),
        FOREIGN KEY (policy_id) REFERENCES remediation_policies(id),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (approved_by) REFERENCES users(username)
      );

      CREATE INDEX IF NOT EXISTS idx_audit_rca ON remediation_audits(rca_id);
      CREATE INDEX IF NOT EXISTS idx_audit_status ON remediation_audits(status);
      CREATE INDEX IF NOT EXISTS idx_audit_server ON remediation_audits(server_id);

      -- Remediation Cooldowns
      CREATE TABLE IF NOT EXISTS remediation_cooldowns (
        policy_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        cooldown_until DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        PRIMARY KEY (policy_id, alert_id),
        FOREIGN KEY (policy_id) REFERENCES remediation_policies(id) ON DELETE CASCADE,
        FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_remediation_cooldowns_until ON remediation_cooldowns(cooldown_until);

      -- Server Metrics
      CREATE TABLE IF NOT EXISTS server_metrics (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        cpu_usage REAL,
        memory_usage REAL,
        memory_total_gb REAL,
        memory_used_gb REAL,
        disk_usage REAL,
        disk_total_gb REAL,
        disk_used_gb REAL,
        network_in_mbps REAL,
        network_out_mbps REAL,
        load_1min REAL,
        load_5min REAL,
        load_15min REAL,
        uptime_seconds INTEGER,
        collected_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_server_metrics_server ON server_metrics(server_id);
      CREATE INDEX IF NOT EXISTS idx_server_metrics_collected ON server_metrics(collected_at DESC);
      CREATE INDEX IF NOT EXISTS idx_server_metrics_server_collected ON server_metrics(server_id, collected_at DESC);

      -- Network Devices
      CREATE TABLE IF NOT EXISTS network_devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL UNIQUE,
        vendor TEXT NOT NULL,
        model TEXT,
        os_version TEXT,
        ssh_port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        enable_password TEXT,
        location TEXT,
        role TEXT,
        status TEXT DEFAULT 'online',
        last_inspection_at DATETIME,
        last_inspection_result TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_network_devices_vendor ON network_devices(vendor);
      CREATE INDEX IF NOT EXISTS idx_network_devices_status ON network_devices(status);
      CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip_address);

      -- Network Inspection History
      CREATE TABLE IF NOT EXISTS network_inspection_history (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        inspection_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        commands_executed INTEGER DEFAULT 0,
        commands_failed INTEGER DEFAULT 0,
        results TEXT,
        summary TEXT,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (device_id) REFERENCES network_devices(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_inspection_history_device ON network_inspection_history(device_id);
      CREATE INDEX IF NOT EXISTS idx_inspection_history_type ON network_inspection_history(inspection_type);
      CREATE INDEX IF NOT EXISTS idx_inspection_history_status ON network_inspection_history(status);
      CREATE INDEX IF NOT EXISTS idx_inspection_history_created ON network_inspection_history(created_at DESC);
    `;
}
