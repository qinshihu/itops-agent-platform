/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Chunk 4 of 5
 *
 * 行数: 142
 * 起始: Notifications
 */

export function upChunk4(): string {
  return `
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

    `;
}
