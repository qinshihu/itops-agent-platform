import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v001InitialSchema: Migration = {
  id: '20240101000001',
  version: 1,
  name: 'initial_schema',
  description: 'Initial database schema with all core tables',
  
  up: async (db: any) => {
    logger.info('🔄 Creating initial database schema...');

    // If tables already exist but lack expected columns (from a previous failed migration),
    // drop them so we can recreate with the correct schema
    const tableColumnChecks: Array<{ table: string; requiredColumns: string[] }> = [
      { table: 'agents', requiredColumns: ['category'] },
      { table: 'scripts', requiredColumns: ['category'] },
      { table: 'knowledge_base', requiredColumns: ['category'] },
    ];

    for (const { table, requiredColumns } of tableColumnChecks) {
      try {
        const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
        if (tableExists) {
          const columns = db.prepare(`PRAGMA table_info(${table})`).all();
          const columnNames = new Set(columns.map((col: any) => col.name));
          const missingColumns = requiredColumns.filter(c => !columnNames.has(c));
          if (missingColumns.length > 0) {
            logger.warn(`⚠️ Dropping incomplete ${table} table from previous failed migration (missing: ${missingColumns.join(', ')})`);
            db.exec(`DROP TABLE IF EXISTS ${table}`);
          }
        }
      } catch {
        // Safe to ignore
      }
    }

    db.exec(`
      -- Token Blacklist
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        user_id TEXT,
        reason TEXT,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        password_must_change INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        last_failed_login DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

      -- Servers
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT,
        private_key TEXT,
        use_ssh_key INTEGER DEFAULT 0,
        description TEXT,
        tags TEXT,
        enabled INTEGER DEFAULT 1,
        last_connected DATETIME,
        os TEXT,
        os_type TEXT DEFAULT 'linux',
        cpu_cores INTEGER,
        memory_gb REAL,
        disk_gb REAL,
        ip_address TEXT,
        private_ip TEXT,
        cloud_provider TEXT,
        cloud_instance_id TEXT,
        vnc_port INTEGER DEFAULT 5900,
        vnc_password TEXT,
        ssh_key_id TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_servers_enabled ON servers(enabled);
      CREATE INDEX IF NOT EXISTS idx_servers_cloud_provider ON servers(cloud_provider);
      CREATE INDEX IF NOT EXISTS idx_servers_cloud_instance ON servers(cloud_provider, cloud_instance_id);
      CREATE INDEX IF NOT EXISTS idx_servers_name ON servers(name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_ip_unique ON servers(ip_address) WHERE ip_address IS NOT NULL;

      -- SSH Keys
      CREATE TABLE IF NOT EXISTS ssh_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        key_type TEXT NOT NULL,
        fingerprint TEXT,
        private_key TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_ssh_keys_name ON ssh_keys(name);

      -- Server Groups
      CREATE TABLE IF NOT EXISTS server_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (parent_id) REFERENCES server_groups(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_server_groups_parent ON server_groups(parent_id);

      -- Server Group Mapping
      CREATE TABLE IF NOT EXISTS server_group_mapping (
        server_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        PRIMARY KEY (server_id, group_id),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES server_groups(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_server_group_mapping_server ON server_group_mapping(server_id);
      CREATE INDEX IF NOT EXISTS idx_server_group_mapping_group ON server_group_mapping(group_id);

      -- Server Command History
      CREATE TABLE IF NOT EXISTS server_command_history (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        command TEXT NOT NULL,
        stdout TEXT,
        stderr TEXT,
        success INTEGER DEFAULT 0,
        execution_time_ms INTEGER,
        executed_by TEXT,
        executed_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_cmd_history_server_id ON server_command_history(server_id);
      CREATE INDEX IF NOT EXISTS idx_cmd_history_executed_at ON server_command_history(executed_at);

      -- Compliance Checks
      CREATE TABLE IF NOT EXISTS compliance_checks (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        check_name TEXT NOT NULL,
        check_results TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        started_at DATETIME,
        completed_at DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_compliance_server_id ON compliance_checks(server_id);
      CREATE INDEX IF NOT EXISTS idx_compliance_status ON compliance_checks(status);
      CREATE INDEX IF NOT EXISTS idx_compliance_created_at ON compliance_checks(created_at);

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

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'unread',
        recipient TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

      -- Notification Configs
      CREATE TABLE IF NOT EXISTS notification_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_enabled INTEGER DEFAULT 1,
        webhook_url TEXT,
        email_enabled INTEGER DEFAULT 0,
        email_config TEXT,
        wechat_enabled INTEGER DEFAULT 0,
        wechat_config TEXT,
        dingtalk_enabled INTEGER DEFAULT 0,
        dingtalk_config TEXT,
        alert_notification TEXT,
        task_notification TEXT,
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      -- Root Cause Analyses
      CREATE TABLE IF NOT EXISTS root_cause_analyses (
        id TEXT PRIMARY KEY,
        alert_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        root_cause TEXT,
        symptoms TEXT,
        timeline TEXT,
        evidence TEXT,
        recommendations TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        completed_at DATETIME,
        FOREIGN KEY (alert_id) REFERENCES alerts(id)
      );

      CREATE INDEX IF NOT EXISTS idx_rca_alert_id ON root_cause_analyses(alert_id);
      CREATE INDEX IF NOT EXISTS idx_rca_status ON root_cause_analyses(status);
      CREATE INDEX IF NOT EXISTS idx_rca_created ON root_cause_analyses(created_at);

      -- Copilot Conversations
      CREATE TABLE IF NOT EXISTS copilot_conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        messages TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_copilot_user_id ON copilot_conversations(user_id);

      -- Alert Configs
      CREATE TABLE IF NOT EXISTS alert_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        channels TEXT NOT NULL,
        webhook_url TEXT,
        email_recipients TEXT,
        rate_limit_minutes INTEGER DEFAULT 5,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_configs_enabled ON alert_configs(enabled);
      CREATE INDEX IF NOT EXISTS idx_alert_configs_level ON alert_configs(level);

      -- Alert Notifications
      CREATE TABLE IF NOT EXISTS alert_notifications (
        id TEXT PRIMARY KEY,
        config_id TEXT NOT NULL,
        level TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        metadata TEXT,
        channels TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        triggered_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_notifications_config_id ON alert_notifications(config_id);
      CREATE INDEX IF NOT EXISTS idx_alert_notifications_level ON alert_notifications(level);
      CREATE INDEX IF NOT EXISTS idx_alert_notifications_triggered_at ON alert_notifications(triggered_at DESC);

      -- Service Topologies
      CREATE TABLE IF NOT EXISTS service_topologies (
        id TEXT PRIMARY KEY,
        source_server_id TEXT NOT NULL,
        target_server_id TEXT NOT NULL,
        dependency_type TEXT NOT NULL,
        protocol TEXT,
        port INTEGER,
        status TEXT DEFAULT 'active',
        last_verified_at TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (source_server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (target_server_id) REFERENCES servers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_topology_source ON service_topologies(source_server_id);
      CREATE INDEX IF NOT EXISTS idx_topology_target ON service_topologies(target_server_id);
      CREATE INDEX IF NOT EXISTS idx_topology_status ON service_topologies(status);

      -- Change Records
      CREATE TABLE IF NOT EXISTS change_records (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        description TEXT,
        changed_by TEXT,
        status TEXT DEFAULT 'completed',
        related_alert_id TEXT,
        is_root_cause INTEGER DEFAULT 0,
        metadata TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (related_alert_id) REFERENCES alerts(id)
      );

      CREATE INDEX IF NOT EXISTS idx_change_server ON change_records(server_id);
      CREATE INDEX IF NOT EXISTS idx_change_type ON change_records(change_type);
      CREATE INDEX IF NOT EXISTS idx_change_status ON change_records(status);
      CREATE INDEX IF NOT EXISTS idx_change_created ON change_records(created_at DESC);

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
    `);

    logger.info('✅ Initial database schema created successfully');
  },

  down: async (db: any) => {
    logger.info('🔄 Dropping initial database schema...');

    db.exec(`
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
    `);

    logger.info('✅ Initial database schema dropped successfully');
  }
};

export default v001InitialSchema;
