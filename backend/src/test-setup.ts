/**
 * Test setup: provides an in-memory SQLite database for isolated testing
 * All services that depend on `import db from '../models/database'` will
 * automatically use this in-memory instance when NODE_ENV='test'.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

// Use an in-memory database for tests to avoid side effects
let testDbInstance: Database.Database | null = null;

/**
 * Create a fresh in-memory database for testing
 */
export function createTestDatabase(): Database.Database {
  if (testDbInstance) {
    testDbInstance.close();
    testDbInstance = null;
  }

  const db = new Database(':memory:');

  // Apply same pragmas as production
  db.pragma('journal_mode = MEMORY');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  createTestTables(db);
  return db;
}

/**
 * Create minimal table structure required for tests
 */
function createTestTables(db: Database.Database): void {
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      display_name TEXT,
      email TEXT,
      phone TEXT,
      avatar TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 1,
      login_fail_count INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      last_login TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 22,
      username TEXT,
      password TEXT,
      use_ssh_key INTEGER NOT NULL DEFAULT 0,
      private_key TEXT,
      public_key TEXT,
      group_id TEXT,
      description TEXT,
      tags TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      model TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 2000,
      is_preset INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      nodes TEXT,
      edges TEXT,
      is_preset INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL DEFAULT 0,
      result TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_nodes (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      workflow_node_id TEXT NOT NULL,
      agent_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT,
      output TEXT,
      started_at TEXT,
      completed_at TEXT,
      error TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      source TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      server_id TEXT,
      rule_id TEXT,
      value REAL,
      acknowledged_at TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_mappings (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source TEXT NOT NULL,
      source_field TEXT,
      pattern TEXT,
      workflow_id TEXT,
      severity TEXT DEFAULT 'info',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      category TEXT DEFAULT 'general',
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      resource TEXT,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cron_expression TEXT NOT NULL,
      workflow_id TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run TEXT,
      next_run TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      config TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      tags TEXT,
      category TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'shell',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT,
      template_id TEXT,
      task_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      template TEXT,
      is_preset INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS remediation_policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      alert_pattern TEXT,
      workflow_id TEXT,
      approval_required INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS remediation_executions (
      id TEXT PRIMARY KEY,
      policy_id TEXT,
      alert_id TEXT,
      workflow_execution_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      initiated_by TEXT,
      approved_by TEXT,
      result TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS changes (
      id TEXT PRIMARY KEY,
      server_id TEXT,
      change_type TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      changed_by TEXT,
      related_alert_id TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS token_blacklist (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_records (
      id TEXT PRIMARY KEY,
      file_path TEXT,
      file_size INTEGER,
      checksum TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS network_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      vendor TEXT,
      model TEXT,
      device_type TEXT DEFAULT 'router',
      username TEXT,
      password TEXT,
      snmp_community TEXT,
      snmp_version TEXT DEFAULT 'v2c',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ssh_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public_key TEXT,
      fingerprint TEXT,
      type TEXT DEFAULT 'ed25519',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topology_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      node_type TEXT NOT NULL,
      ip_address TEXT,
      properties TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topology_edges (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      edge_type TEXT DEFAULT 'network',
      properties TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model_name TEXT NOT NULL,
      api_key TEXT,
      api_base TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS server_info (
      id TEXT PRIMARY KEY,
      server_id TEXT NOT NULL,
      os TEXT,
      cpu_cores INTEGER,
      cpu_model TEXT,
      memory_total INTEGER,
      disk_total INTEGER,
      ip_address TEXT,
      collected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Get or create the test database singleton
 */
export function getTestDb(): Database.Database {
  if (!testDbInstance) {
    testDbInstance = createTestDatabase();
  }
  return testDbInstance;
}

/**
 * Insert a default admin user for auth tests
 */
export function seedTestUser(db: Database.Database, overrides: Record<string, any> = {}): string {
  const id = overrides.id || randomUUID();
  const password = overrides.password || bcrypt.hashSync('TestPass123!', 12);
  const username = overrides.username || 'admin';

  db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password, role, display_name, is_active, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    username,
    password,
    overrides.role || 'admin',
    overrides.display_name || 'Admin',
    overrides.is_active !== undefined ? (overrides.is_active ? 1 : 0) : 1,
    overrides.must_change_password !== undefined ? (overrides.must_change_password ? 1 : 0) : 0
  );

  return id;
}

/**
 * Reset all tables (for use in beforeEach)
 */
export function resetTestTables(db: Database.Database): void {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[];

  const order = [
    'task_nodes', 'tasks', 'remediation_executions', 'changes',
    'topology_edges', 'topology_nodes', 'server_info', 'alert_mappings',
    'alerts', 'audit_logs', 'backup_records', 'token_blacklist',
    'scheduled_tasks', 'notification_configs', 'ssh_keys', 'network_devices',
    'remediation_policies', 'report_templates', 'reports', 'scripts',
    'knowledge_entries', 'credentials', 'ai_models', 'agents',
    'workflows', 'servers', 'server_groups', 'users', 'settings'
  ];

  for (const table of order) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // table might not exist, skip
    }
  }
}

/**
 * Close and cleanup the test database
 */
export function closeTestDatabase(): void {
  if (testDbInstance) {
    testDbInstance.close();
    testDbInstance = null;
  }
}
