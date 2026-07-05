/**
 * snmpRepository — snmp_credentials / snmp_trap_events 表的统一数据访问层
 *
 * 取代 snmpRoutes.ts 中散落的 db.prepare 调用。
 * 凭证加密/解密仍保留在调用方（路由层），仓库层仅做数据访问。
 *
 * snmp_credentials 表结构（v010 + 运行时 ALTER）：
 *   id, device_id, name, community, snmp_version, snmp_port,
 *   snmp_user, snmp_auth_protocol, snmp_auth_key,
 *   snmp_priv_protocol, snmp_priv_key, host(运行时 ALTER),
 *   created_at, updated_at
 *
 * snmp_trap_events 表结构（v010）：
 *   id, source_ip, trap_type, enterprise_oid, agent_address,
 *   generic_type, specific_type, varbinds_json, created_at
 */

import db from '../models/database';

// ── snmp_credentials 类型 ──

export interface SnmpCredentialRecord {
  id: string;
  device_id?: string | null;
  name: string;
  community?: string | null;
  snmp_version: string;
  snmp_port: number;
  snmp_user?: string | null;
  snmp_auth_protocol?: string | null;
  snmp_auth_key?: string | null;
  snmp_priv_protocol?: string | null;
  snmp_priv_key?: string | null;
  host?: string | null;
  created_at: string;
  updated_at: string;
}

/** 凭证列表行（含联表 host） */
export interface SnmpCredentialListRow {
  id: string;
  device_id: string | null;
  name: string;
  snmp_version: string;
  snmp_port: number;
  snmp_user: string | null;
  snmp_auth_protocol: string | null;
  snmp_priv_protocol: string | null;
  created_at: string;
  updated_at: string;
  host: string | null;
}

/** 凭证详情行（含联表 host，全字段） */
export interface SnmpCredentialDetailRow extends SnmpCredentialRecord {
  host: string | null;
}

export interface SnmpCredentialCreateInput {
  id: string;
  device_id?: string | null;
  name?: string;
  community?: string | null;
  snmp_version?: string;
  snmp_port?: number;
  snmp_user?: string | null;
  snmp_auth_protocol?: string | null;
  snmp_auth_key?: string | null;
  snmp_priv_protocol?: string | null;
  snmp_priv_key?: string | null;
  host?: string | null;
}

export interface SnmpCredentialUpdateInput {
  name?: string;
  community?: string | null;
  snmp_version?: string;
  snmp_port?: number;
  snmp_user?: string | null;
  snmp_auth_protocol?: string | null;
  snmp_auth_key?: string | null;
  snmp_priv_protocol?: string | null;
  snmp_priv_key?: string | null;
  host?: string | null;
}

// ── snmp_trap_events 类型 ──

export interface SnmpTrapEventInsertInput {
  id: string;
  source_ip: string;
  trap_type?: string | null;
  enterprise_oid?: string | null;
  agent_address?: string | null;
  generic_type?: number;
  specific_type?: number;
  varbinds_json?: string | null;
  created_at?: string;
}

// ── snmp_credentials 子 repository ──

export const snmpCredentialsRepo = {
  /** 确保 snmp_credentials 表有 host 列（运行时 ALTER，幂等） */
  ensureHostColumn(): void {
    try {
      const cols = db.prepare("PRAGMA table_info('snmp_credentials')").all() as { name: string }[];
      if (!cols.find(c => c.name === 'host')) {
        db.exec('ALTER TABLE snmp_credentials ADD COLUMN host TEXT');
      }
    } catch { /* 表可能还不存在 */ }
  },

  /** 列出凭证（含联表 host），可选按 device_id 过滤 */
  list(deviceId?: string): SnmpCredentialListRow[] {
    const baseSql = `
      SELECT c.id, c.device_id, c.name, c.snmp_version, c.snmp_port,
             c.snmp_user, c.snmp_auth_protocol, c.snmp_priv_protocol,
             c.created_at, c.updated_at, COALESCE(c.host, nd.ip_address) AS host
      FROM snmp_credentials c
      LEFT JOIN network_devices nd ON c.device_id = nd.id
    `;
    if (deviceId) {
      return db.prepare(`${baseSql} WHERE c.device_id = ? ORDER BY c.snmp_version DESC`)
        .all(deviceId) as SnmpCredentialListRow[];
    }
    return db.prepare(`${baseSql} ORDER BY c.device_id`).all() as SnmpCredentialListRow[];
  },

  /**
   * 按 ID 获取凭证（含联表 host，全字段）
   * 注意：host 取 nd.ip_address（与原 snmpRoutes.ts test-by-id 路由语义一致，
   * c.* 中的 c.host 会被末尾的 AS host 别名覆盖）
   */
  getByIdWithHost(id: string): SnmpCredentialDetailRow | undefined {
    return db.prepare(`
      SELECT c.*, nd.ip_address AS host
      FROM snmp_credentials c
      LEFT JOIN network_devices nd ON c.device_id = nd.id
      WHERE c.id = ?
    `).get(id) as SnmpCredentialDetailRow | undefined;
  },

  /** 创建凭证（业务层已处理加密） */
  create(input: SnmpCredentialCreateInput): void {
    db.prepare(`
      INSERT INTO snmp_credentials (id, device_id, name, community, snmp_version, snmp_port,
        snmp_user, snmp_auth_protocol, snmp_auth_key, snmp_priv_protocol, snmp_priv_key, host)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.device_id ?? null,
      input.name || 'default',
      input.community ?? null,
      input.snmp_version ?? 'v2c',
      input.snmp_port ?? 161,
      input.snmp_user ?? null,
      input.snmp_auth_protocol ?? null,
      input.snmp_auth_key ?? null,
      input.snmp_priv_protocol ?? null,
      input.snmp_priv_key ?? null,
      input.host ?? null,
    );
  },

  /** 更新凭证（COALESCE 部分更新，业务层已处理加密） */
  update(id: string, input: SnmpCredentialUpdateInput): void {
    db.prepare(`
      UPDATE snmp_credentials SET
        name = COALESCE(?, name),
        community = COALESCE(?, community),
        snmp_version = COALESCE(?, snmp_version),
        snmp_port = COALESCE(?, snmp_port),
        snmp_user = COALESCE(?, snmp_user),
        snmp_auth_protocol = COALESCE(?, snmp_auth_protocol),
        snmp_auth_key = COALESCE(?, snmp_auth_key),
        snmp_priv_protocol = COALESCE(?, snmp_priv_protocol),
        snmp_priv_key = COALESCE(?, snmp_priv_key),
        host = COALESCE(?, host),
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.name ?? null,
      input.community ?? null,
      input.snmp_version ?? null,
      input.snmp_port ?? null,
      input.snmp_user ?? null,
      input.snmp_auth_protocol ?? null,
      input.snmp_auth_key ?? null,
      input.snmp_priv_protocol ?? null,
      input.snmp_priv_key ?? null,
      input.host ?? null,
      id,
    );
  },

  /** 按 ID 删除凭证 */
  delete(id: string): void {
    db.prepare('DELETE FROM snmp_credentials WHERE id = ?').run(id);
  },

  /** 按 ID 查询凭证（全字段，含敏感字段） */
  getById(id: string): SnmpCredentialRecord | undefined {
    return db.prepare('SELECT * FROM snmp_credentials WHERE id = ?').get(id) as SnmpCredentialRecord | undefined;
  },

  /** 获取设备的最新凭证（按 snmp_version DESC，全字段含敏感信息） */
  getByDeviceId(deviceId: string): SnmpCredentialRecord | undefined {
    return db.prepare('SELECT * FROM snmp_credentials WHERE device_id = ? ORDER BY snmp_version DESC LIMIT 1')
      .get(deviceId) as SnmpCredentialRecord | undefined;
  },

  /** 获取默认凭证（device_id IS NULL） */
  getDefault(): SnmpCredentialRecord | undefined {
    return db.prepare('SELECT * FROM snmp_credentials WHERE device_id IS NULL LIMIT 1')
      .get() as SnmpCredentialRecord | undefined;
  },
};

// ── snmp_trap_events 子 repository ──

export const snmpTrapEventsRepo = {
  /** 插入 Trap 事件 */
  insert(input: SnmpTrapEventInsertInput): void {
    db.prepare(`
      INSERT INTO snmp_trap_events (id, source_ip, trap_type, enterprise_oid, agent_address,
        generic_type, specific_type, varbinds_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.source_ip,
      input.trap_type ?? null,
      input.enterprise_oid ?? null,
      input.agent_address ?? null,
      input.generic_type ?? 0,
      input.specific_type ?? 0,
      input.varbinds_json ?? null,
      input.created_at,
    );
  },

  /** 列出 Trap 事件（可选按 sourceIp 过滤） */
  list(limit = 50, sourceIp?: string): SnmpCredentialRecord[] {
    let query: string;
    const params: (string | number)[] = [];
    if (sourceIp) {
      query = 'SELECT * FROM snmp_trap_events WHERE source_ip = ? ORDER BY created_at DESC LIMIT ?';
      params.push(sourceIp, limit);
    } else {
      query = 'SELECT * FROM snmp_trap_events ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
    }
    return db.prepare(query).all(...params) as SnmpCredentialRecord[];
  },
};

// ── network_inspection_history / snmp_interface_metrics 子 repository ──

/** 巡检历史记录（告警自动分析用） */
export interface InspectionHistoryRecord {
  id: string;
  inspection_type: string;
  status: string;
  results: string;
  summary: string;
  commands_executed: string;
  created_at: string;
}

/** 接口指标记录（告警自动分析用） */
export interface InterfaceMetricRecord {
  interface_name: string;
  if_index: number;
  if_speed: number;
  if_admin_status: number;
  if_oper_status: number;
  if_in_octets: number;
  if_out_octets: number;
  if_in_errors: number;
  if_out_errors: number;
  sampled_at: string;
}

export const snmpInspectionRepo = {
  /**
   * 列出设备最近的 SNMP 巡检记录
   * 对应：deviceResolver.getSnmpInspectionData
   */
  listRecentByDeviceId(deviceId: string, limit = 3): InspectionHistoryRecord[] {
    return db.prepare(`
      SELECT id, inspection_type, status, results, summary, commands_executed, created_at
      FROM network_inspection_history
      WHERE device_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(deviceId, limit) as InspectionHistoryRecord[];
  },

  /**
   * 列出设备最近的接口指标
   * 对应：deviceResolver.getSnmpInspectionData（巡检记录为空时的 fallback）
   */
  listRecentInterfaceMetrics(deviceId: string, limit = 10): InterfaceMetricRecord[] {
    return db.prepare(`
      SELECT interface_name, if_index, if_speed, if_admin_status, if_oper_status,
             if_in_octets, if_out_octets, if_in_errors, if_out_errors,
             sampled_at
      FROM snmp_interface_metrics
      WHERE device_id = ?
      ORDER BY sampled_at DESC
      LIMIT ?
    `).all(deviceId, limit) as InterfaceMetricRecord[];
  },

  /**
   * 获取设备 7 天内接口流量均值（用于基线计算）
   * 对应：deviceProfiler.loadBaseline
   */
  getInterfaceTrafficBaseline(deviceId: string): { traffic_avg: number | null; samples: number } | undefined {
    return db.prepare(`
      SELECT AVG(if_in_octets) as traffic_avg, COUNT(*) as samples
      FROM snmp_interface_metrics
      WHERE device_id = ? AND sampled_at >= datetime('now', '-7 days', 'localtime')
    `).get(deviceId) as { traffic_avg: number | null; samples: number } | undefined;
  },

  /** 按 ID 获取单条巡检记录（全字段） */
  getById(id: string): InspectionHistoryRecord | undefined {
    return db.prepare('SELECT * FROM network_inspection_history WHERE id = ?')
      .get(id) as InspectionHistoryRecord | undefined;
  },

  /** 列出设备的所有巡检记录（全字段，用于分页） */
  listAllByDeviceId(deviceId: string, limit = 20): InspectionHistoryRecord[] {
    return db.prepare('SELECT * FROM network_inspection_history WHERE device_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(deviceId, limit) as InspectionHistoryRecord[];
  },

  /** 创建巡检记录（初始 running 状态） */
  createRunning(input: { id: string; device_id: string; inspection_type: string; status: string }): void {
    db.prepare('INSERT INTO network_inspection_history (id, device_id, inspection_type, status) VALUES (?, ?, ?, ?)')
      .run(input.id, input.device_id, input.inspection_type, input.status);
  },

  /** 更新巡检结果 */
  updateResult(id: string, data: {
    status: string; commands_executed: number; commands_failed: number;
    results: string; summary: string; duration_ms: number;
  }): void {
    db.prepare(`
      UPDATE network_inspection_history
      SET status = ?, commands_executed = ?, commands_failed = ?, results = ?, summary = ?, duration_ms = ?
      WHERE id = ?
    `).run(data.status, data.commands_executed, data.commands_failed, data.results, data.summary, data.duration_ms, id);
  },

  /** 更新巡检失败信息 */
  updateFailed(id: string, summary: string, durationMs: number): void {
    db.prepare('UPDATE network_inspection_history SET status = ?, summary = ?, duration_ms = ? WHERE id = ?')
      .run('failed', summary, durationMs, id);
  },

  /** 插入巡检结果（SNMP 轮询用） */
  insertSnmpResult(input: {
    id: string; device_id: string; inspection_type: string; status: string;
    commands_executed: number; commands_failed: number; results: string; summary: string; duration_ms: number;
  }): void {
    db.prepare(`
      INSERT INTO network_inspection_history
        (id, device_id, inspection_type, status, commands_executed, commands_failed, results, summary, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.device_id, input.inspection_type, input.status, input.commands_executed, input.commands_failed, input.results, input.summary, input.duration_ms);
  },
};

// ── baseline_metrics 子 repository ──

export const baselineMetricsRepo = {
  ensureTable(): void {
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS baseline_metrics (
        device_id TEXT NOT NULL,
        metric_name TEXT NOT NULL,
        sample_value REAL NOT NULL,
        sampled_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        PRIMARY KEY (device_id, metric_name, sampled_at)
      )`);
    } catch { /* ignore */ }
  },

  insertBatch(deviceId: string, metrics: Record<string, number>): void {
    const stmt = db.prepare(`INSERT INTO baseline_metrics (device_id, metric_name, sample_value) VALUES (?, ?, ?)`);
    const tx = db.transaction(() => {
      for (const [name, value] of Object.entries(metrics)) {
        stmt.run(deviceId, name, value);
      }
    });
    try { tx(); } catch { /* ignore */ }
  },
};

// ── snmp_polling_snapshots 子 repository ──

export const snmpPollingRepo = {
  /** 确保快照表存在 */
  ensureTable(): void {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='snmp_polling_snapshots'").all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS snmp_polling_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          interface_index INTEGER NOT NULL,
          in_octets TEXT DEFAULT '0',
          out_octets TEXT DEFAULT '0',
          in_errors INTEGER DEFAULT 0,
          out_errors INTEGER DEFAULT 0,
          last_poll_at TEXT,
          UNIQUE(device_id, interface_index)
        )
      `);
    }
  },

  /** 获取设备所有快照 */
  getByDeviceId(deviceId: string): Array<{
    device_id: string; interface_index: number; in_octets: string;
    out_octets: string; in_errors: number; out_errors: number; last_poll_at: string;
  }> {
    return db.prepare('SELECT * FROM snmp_polling_snapshots WHERE device_id = ?')
      .all(deviceId) as Array<{
        device_id: string; interface_index: number; in_octets: string;
        out_octets: string; in_errors: number; out_errors: number; last_poll_at: string;
      }>;
  },

  /** 批量 upsert 接口快照 */
  upsertBatch(deviceId: string, interfaces: Array<{
    index: number; inOctets: bigint | number; outOctets: bigint | number;
    inErrors: number; outErrors: number;
  }>, now: string): void {
    const upsert = db.prepare(`
      INSERT INTO snmp_polling_snapshots (device_id, interface_index, in_octets, out_octets, in_errors, out_errors, last_poll_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, interface_index) DO UPDATE SET
        in_octets = excluded.in_octets,
        out_octets = excluded.out_octets,
        in_errors = excluded.in_errors,
        out_errors = excluded.out_errors,
        last_poll_at = excluded.last_poll_at
    `);
    const tx = db.transaction(() => {
      for (const iface of interfaces) {
        upsert.run(deviceId, iface.index, String(iface.inOctets), String(iface.outOctets), iface.inErrors, iface.outErrors, now);
      }
    });
    tx();
  },
};

// ── 聚合导出（兼容 snmpRepository.* 调用风格）──

export const snmpRepository = {
  credentials: snmpCredentialsRepo,
  trapEvents: snmpTrapEventsRepo,
  inspection: snmpInspectionRepo,
  baseline: baselineMetricsRepo,
  polling: snmpPollingRepo,
};
