import Database from 'better-sqlite3';

/**
 * v009 — 补充网络设备/平台/告警关联的完整覆盖
 *
 * 新增表：
 *   - network_config_backups      设备配置备份
 *   - network_lldp_neighbors       LLDP/CDP 邻居条目
 *   - network_external_devices    未管理的发现设备
 *   - network_topology_links      拓扑链路
 *   - alert_device_associations   告警→设备关联
 *   - alert_device_match_log      未匹配告警日志（辅助学习）
 *
 * 新增字段（已存在表）：
 *   - network_devices.last_backup_at
 *   - network_devices.device_type (switch/router/firewall/loadbalancer/wlc/ap/gateway)
 *   - servers.gpu_count / gpu_model (GPU 监控)
 *   - servers.os_detail (macOS/FreeBSD/Solaris/AIX 识别)
 */
export function up(db: Database.Database): void {
  // ── 网络设备配置备份 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_config_backups (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      config_md5 TEXT NOT NULL DEFAULT '',
      config_text TEXT,
      config_size INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','partial')),
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_config_backups_device ON network_config_backups(device_id, created_at DESC);
  `);

  // ── LLDP/CDP 邻居条目 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_lldp_neighbors (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      local_interface TEXT,
      remote_device_name TEXT,
      remote_interface TEXT,
      remote_platform TEXT,
      remote_mgmt_ip TEXT,
      protocol TEXT NOT NULL DEFAULT 'lldp' CHECK (protocol IN ('lldp','cdp')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_lldp_neighbors_device ON network_lldp_neighbors(device_id);
    CREATE INDEX IF NOT EXISTS idx_lldp_neighbors_remote ON network_lldp_neighbors(remote_device_name);
  `);

  // ── 拓扑中发现但未管理的设备 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_external_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discovered_from_device_id TEXT REFERENCES network_devices(id) ON DELETE SET NULL,
      platform TEXT,
      management_ip TEXT,
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ext_device_name ON network_external_devices(name);
  `);

  // ── 拓扑链路 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_topology_links (
      id TEXT PRIMARY KEY,
      deviceA_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      deviceA_name TEXT,
      deviceA_interface TEXT,
      deviceB_id TEXT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
      deviceB_name TEXT,
      deviceB_interface TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','stale')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_topo_links_deviceA ON network_topology_links(deviceA_id);
    CREATE INDEX IF NOT EXISTS idx_topo_links_deviceB ON network_topology_links(deviceB_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_topo_links_unique
      ON network_topology_links(deviceA_id, deviceA_interface, deviceB_id, deviceB_interface);
  `);

  // ── 告警→设备关联 ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_device_associations (
      alert_id TEXT NOT NULL,
      device_type TEXT NOT NULL CHECK (device_type IN ('server','network_device')),
      device_id TEXT NOT NULL,
      match_method TEXT NOT NULL DEFAULT 'auto' CHECK (match_method IN ('exact_hostname','fuzzy_hostname','ip_address','title_keyword','manual')),
      confidence INTEGER DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      PRIMARY KEY (alert_id)
    );
  `);

  // ── 未匹配告警日志（辅助人工/自动学习匹配规则） ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_device_match_log (
      id TEXT PRIMARY KEY,
      alert_title TEXT,
      alert_hostname TEXT,
      match_method TEXT DEFAULT 'auto',
      matched INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_match_log_unmatched ON alert_device_match_log(matched, created_at DESC);
  `);

  // ── servers 表补充 GPU 和 OS 字段 ──
  const serverColumns = db.prepare("PRAGMA table_info('servers')").all() as { name: string }[];
  const serverNames = serverColumns.map(c => c.name);

  if (!serverNames.includes('gpu_count')) {
    db.exec(`ALTER TABLE servers ADD COLUMN gpu_count INTEGER DEFAULT 0;`);
  }
  if (!serverNames.includes('gpu_model')) {
    db.exec(`ALTER TABLE servers ADD COLUMN gpu_model TEXT;`);
  }
  if (!serverNames.includes('os_detail')) {
    db.exec(`ALTER TABLE servers ADD COLUMN os_detail TEXT;`);
  }

  // ── network_devices 补充设备类型和备份时间 ──
  const ndColumns = db.prepare("PRAGMA table_info('network_devices')").all() as { name: string }[];
  const ndNames = ndColumns.map(c => c.name);

  if (!ndNames.includes('device_type')) {
    db.exec(`
      ALTER TABLE network_devices ADD COLUMN device_type TEXT
        DEFAULT 'unknown' CHECK (device_type IN ('switch','router','firewall','loadbalancer','wlc','ap','gateway','unknown'));
    `);
    // 根据现有 vendor 做默认推断
    db.exec(`
      UPDATE network_devices SET device_type = 'firewall' WHERE vendor IN ('fortinet','paloalto');
      UPDATE network_devices SET device_type = 'loadbalancer' WHERE vendor = 'f5';
      UPDATE network_devices SET device_type = 'switch' WHERE vendor IN ('arista','hpe','dell','tplink');
    `);
  }
  if (!ndNames.includes('last_backup_at')) {
    db.exec(`ALTER TABLE network_devices ADD COLUMN last_backup_at TEXT;`);
  }
  if (!ndNames.includes('device_role')) {
    db.exec(`ALTER TABLE network_devices ADD COLUMN device_role TEXT;`);
  }

  // ── 网络巡检历史增加新的巡检类型字段 ──
  const inspectColumns = db.prepare("PRAGMA table_info('network_inspection_history')").all() as { name: string }[];
  const inspectNames = inspectColumns.map(c => c.name);
  if (!inspectNames.includes('device_type')) {
    db.exec(`ALTER TABLE network_inspection_history ADD COLUMN device_type TEXT DEFAULT 'unknown';`);
  }
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS alert_device_match_log;
    DROP TABLE IF EXISTS alert_device_associations;
    DROP TABLE IF EXISTS network_topology_links;
    DROP TABLE IF EXISTS network_external_devices;
    DROP TABLE IF EXISTS network_lldp_neighbors;
    DROP TABLE IF EXISTS network_config_backups;
  `);

  // ALTER TABLE 的 DROP 不在 SQLite 支持范围内，略过
}
