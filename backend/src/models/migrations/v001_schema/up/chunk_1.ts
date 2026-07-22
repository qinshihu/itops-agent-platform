/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Up SQL Chunk 1 of 5
 *
 * 行数: 143
 * 起始: Token Blacklist
 */

export function upChunk1(): string {
  return `
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

    `;
}
