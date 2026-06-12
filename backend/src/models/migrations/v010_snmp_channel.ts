import Database from 'better-sqlite3';

/**
 * v010 — SNMP 通道支持
 *
 * 新增表：
 *   - snmp_credentials       SNMP 凭证（v1/v2c community, v3 用户认证）
 *   - snmp_trap_events        Trap 接收事件记录
 *   - snmp_polling_tasks      定时轮询配置
 *   - snmp_interface_metrics  接口指标采样历史
 *
 * 新增字段：
 *   - network_devices.snmp_enabled
 *   - network_devices.last_snmp_at
 */
export function up(db: Database.Database): void {
  // ── SNMP 凭证 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS snmp_credentials (
      id TEXT PRIMARY KEY,
      device_id TEXT REFERENCES network_devices(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'default',
      community TEXT,
      snmp_version TEXT NOT NULL DEFAULT 'v2c' CHECK (snmp_version IN ('v1','v2c','v3')),
      snmp_port INTEGER NOT NULL DEFAULT 161,
      snmp_user TEXT,
      snmp_auth_protocol TEXT CHECK (snmp_auth_protocol IN ('MD5','SHA')),
      snmp_auth_key TEXT,
      snmp_priv_protocol TEXT CHECK (snmp_priv_protocol IN ('DES','AES')),
      snmp_priv_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_snmp_cred_device ON snmp_credentials(device_id);
  `);

  // ── SNMP Trap 事件 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS snmp_trap_events (
      id TEXT PRIMARY KEY,
      source_ip TEXT NOT NULL,
      trap_type TEXT,
      enterprise_oid TEXT,
      agent_address TEXT,
      generic_type INTEGER DEFAULT 0,
      specific_type INTEGER DEFAULT 0,
      varbinds_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_snmp_trap_ip ON snmp_trap_events(source_ip);
    CREATE INDEX IF NOT EXISTS idx_snmp_trap_time ON snmp_trap_events(created_at DESC);
  `);

  // ── SNMP 定时轮询任务 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS snmp_polling_tasks (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      poll_interval_seconds INTEGER NOT NULL DEFAULT 300,
      poll_items TEXT NOT NULL DEFAULT '["cpu","memory","interfaces"]',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_poll_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_snmp_poll_device ON snmp_polling_tasks(device_id);
  `);

  // ── SNMP 接口指标历史 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS snmp_interface_metrics (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      if_index INTEGER NOT NULL,
      if_name TEXT,
      in_octets REAL,
      out_octets REAL,
      in_errors REAL,
      out_errors REAL,
      in_utilization REAL,
      out_utilization REAL,
      sampled_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_snmp_metrics_device ON snmp_interface_metrics(device_id, if_index, sampled_at DESC);
  `);

  // ── network_devices 扩充 SNMP 字段 ──
  const ndColumns = db.prepare("PRAGMA table_info('network_devices')").all() as { name: string }[];
  const ndNames = ndColumns.map(c => c.name);

  if (!ndNames.includes('snmp_enabled')) {
    db.exec(`ALTER TABLE network_devices ADD COLUMN snmp_enabled INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!ndNames.includes('last_snmp_at')) {
    db.exec(`ALTER TABLE network_devices ADD COLUMN last_snmp_at TEXT;`);
  }
  if (!ndNames.includes('snmp_port')) {
    db.exec(`ALTER TABLE network_devices ADD COLUMN snmp_port INTEGER DEFAULT 161;`);
  }
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS snmp_interface_metrics;
    DROP TABLE IF EXISTS snmp_polling_tasks;
    DROP TABLE IF EXISTS snmp_trap_events;
    DROP TABLE IF EXISTS snmp_credentials;
  `);
}
