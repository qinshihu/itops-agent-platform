/**
 * networkDeviceRepository — 核心 CRUD 操作
 *
 * 取代 networkDeviceService.ts / networkInspectionService.ts / alertAutoAnalyzer.ts /
 *       alertDeviceResolver.ts / configBackupService.ts 等散落的 db.prepare 调用。
 *
 * 说明：仓库层仅做数据访问；密码加密、ssh_key 解析等业务逻辑保留在 service 层。
 */

import db from '../../models/database';
import type {
  NetworkDeviceRecord,
  NetworkDeviceWithCredentialName,
  NetworkDeviceCredentials,
  NetworkDeviceSshCredentials,
  NetworkDeviceBasic,
  NetworkDeviceCreateInput,
  NetworkDeviceUpdateInput,
  NetworkDeviceDiscoveryInput,
} from './types';

export const networkDeviceCoreRepo = {
  // ── SELECT：列表 ──

  /**
   * 列出全部设备（含 SNMP 凭证名），按创建时间倒序
   * 对应 networkDeviceService.ts S1
   */
  list(): NetworkDeviceWithCredentialName[] {
    return db.prepare(`
      SELECT nd.*, sc.name AS snmp_credential_name
      FROM network_devices nd
      LEFT JOIN snmp_credentials sc ON nd.snmp_credential_id = sc.id
      ORDER BY nd.created_at DESC
    `).all() as NetworkDeviceWithCredentialName[];
  },

  /**
   * MCP 工具查询（支持 device_type/manufacturer/status 过滤 + limit）
   * 对应：toolDefinitions network.device.list
   */
  listWithFilters(filters: { deviceType?: string; vendor?: string; status?: string; limit?: number }): NetworkDeviceWithCredentialName[] {
    let query = `
      SELECT nd.*, sc.name AS snmp_credential_name
      FROM network_devices nd
      LEFT JOIN snmp_credentials sc ON nd.snmp_credential_id = sc.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    if (filters.deviceType) { query += ' AND nd.device_type = ?'; params.push(filters.deviceType); }
    if (filters.vendor) { query += ' AND nd.manufacturer = ?'; params.push(filters.vendor); }
    if (filters.status) { query += ' AND nd.status = ?'; params.push(filters.status); }
    query += ` LIMIT ${filters.limit || 50}`;
    return db.prepare(query).all(...params) as NetworkDeviceWithCredentialName[];
  },

  /**
   * 列出 SNMP 启用设备的基础信息（id/name/ip_address）
   * 对应 snmpPollingService.ts S21
   */
  listSnmpEnabledBasic(): NetworkDeviceBasic[] {
    return db.prepare('SELECT id, name, ip_address FROM network_devices WHERE snmp_enabled = 1')
      .all() as NetworkDeviceBasic[];
  },

  /**
   * 按状态列表返回 id（如 status IN ('online','unknown')）
   * 对应 lldpDiscoveryService.ts S27 / configBackupService.ts S36
   */
  listIdsByStatus(statuses: string[]): Array<{ id: string }> {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => '?').join(',');
    return db.prepare(`SELECT id FROM network_devices WHERE status IN (${placeholders})`)
      .all(...statuses) as Array<{ id: string }>;
  },

  // ── SELECT：单条查询 ──

  /**
   * 按 id 获取完整记录（不含联表）
   * 对应 networkDeviceService.ts S3 / linkageRoutes.ts S33
   */
  getById(id: string): NetworkDeviceRecord | undefined {
    return db.prepare('SELECT * FROM network_devices WHERE id = ?').get(id) as NetworkDeviceRecord | undefined;
  },

  /**
   * 按 id 获取完整记录 + SNMP 凭证名
   * 对应 networkDeviceService.ts S2
   */
  getByIdWithCredential(id: string): NetworkDeviceWithCredentialName | undefined {
    return db.prepare(`
      SELECT nd.*, sc.name AS snmp_credential_name
      FROM network_devices nd
      LEFT JOIN snmp_credentials sc ON nd.snmp_credential_id = sc.id
      WHERE nd.id = ?
    `).get(id) as NetworkDeviceWithCredentialName | undefined;
  },

  /**
   * 按 id 获取基础信息（id/name/ip_address）
   * 对应 rootCauseAnalysisService.ts S11/S12 / snmpRoutes.ts S17/S18 / snmpService.ts S31
   */
  getByIdBasic(id: string): NetworkDeviceBasic | undefined {
    return db.prepare('SELECT id, name, ip_address FROM network_devices WHERE id = ?')
      .get(id) as NetworkDeviceBasic | undefined;
  },

  /**
   * 按 id 获取 id/name（告警设备关联用）
   * 对应 alertDeviceResolver.ts S6
   */
  getByIdNameOnly(id: string): { id: string; name: string } | undefined {
    return db.prepare('SELECT id, name FROM network_devices WHERE id = ?')
      .get(id) as { id: string; name: string } | undefined;
  },

  /**
   * 按 id 获取 name/ip_address（联动路由用）
   * 对应 linkageRoutes.ts S32
   */
  getNameAndIp(id: string): { name: string; ip_address: string } | undefined {
    return db.prepare('SELECT name, ip_address FROM network_devices WHERE id = ?')
      .get(id) as { name: string; ip_address: string } | undefined;
  },

  /**
   * 按 id 获取 name（告警关联用）
   * 对应 alertCorrelationService.ts S10
   */
  getName(id: string): string | undefined {
    const row = db.prepare('SELECT name FROM network_devices WHERE id = ?').get(id) as { name: string } | undefined;
    return row?.name;
  },

  /**
   * 按 id 获取 vendor（告警自动分析用）
   * 对应 alertAutoAnalyzer.ts S41
   */
  getVendor(id: string): string | undefined {
    const row = db.prepare('SELECT vendor FROM network_devices WHERE id = ?').get(id) as { vendor: string } | undefined;
    return row?.vendor;
  },

  /**
   * 按 id 获取 id/name/ip_address/vendor（SNMP 服务健康检查用）
   * 对应 snmpService.ts S31
   */
  getByIdWithVendor(id: string): { id: string; name: string; ip_address: string; vendor: string } | undefined {
    return db.prepare('SELECT id, name, ip_address, vendor FROM network_devices WHERE id = ?')
      .get(id) as { id: string; name: string; ip_address: string; vendor: string } | undefined;
  },

  /**
   * 按 ip 获取 id/name（告警设备解析用）
   * 对应 alertDeviceResolver.ts S8 / snmpTrapService.ts S30
   */
  getByIp(ip: string): { id: string; name: string } | undefined {
    return db.prepare('SELECT id, name FROM network_devices WHERE ip_address = ?')
      .get(ip) as { id: string; name: string } | undefined;
  },

  /**
   * 按 ip 查询是否存在（设备发现去重用）
   * 对应 networkDiscoveryService.ts S26
   */
  getIdByIp(ip: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM network_devices WHERE ip_address = ?')
      .get(ip) as { id: string } | undefined;
  },

  /**
   * 按 name 或 ip 匹配（告警设备解析用）
   * 对应 alertDeviceResolver.ts S7 / lldpDiscoveryService.ts S29
   */
  getByNameOrIp(name: string, ip: string): { id: string; name: string } | undefined {
    return db.prepare('SELECT id, name FROM network_devices WHERE name = ? OR ip_address = ?')
      .get(name, ip) as { id: string; name: string } | undefined;
  },

  /**
   * 按 name 模糊匹配，LIMIT 1（告警关键词匹配用）
   * 对应 alertDeviceResolver.ts S9
   */
  findByNameLike(namePattern: string): { id: string; name: string } | undefined {
    return db.prepare('SELECT id, name FROM network_devices WHERE name LIKE ? LIMIT 1')
      .get(namePattern) as { id: string; name: string } | undefined;
  },

  /**
   * 按 ip 获取含 SSH 凭证的设备（username 非空）
   * 对应 deviceProfiler.ts S22 / alertAutoAnalyzer.ts S39
   */
  getByIpWithSshCreds(ip: string): NetworkDeviceCredentials | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, username, password
      FROM network_devices WHERE ip_address = ? AND username IS NOT NULL AND username != ''
      LIMIT 1
    `).get(ip) as NetworkDeviceCredentials | undefined;
  },

  /**
   * 按 ip 获取 SNMP-only 设备（username 为空）
   * 对应 deviceProfiler.ts S23 / alertAutoAnalyzer.ts S40
   */
  getByIpSnmpOnly(ip: string): NetworkDeviceBasic | undefined {
    return db.prepare(`
      SELECT id, name, ip_address FROM network_devices
      WHERE ip_address = ? AND (username IS NULL OR username = '')
      LIMIT 1
    `).get(ip) as NetworkDeviceBasic | undefined;
  },

  // ── SELECT：凭证查询 ──

  /**
   * 按 id 获取完整连接凭证（8 字段，含 enable_password）
   * 对应 networkInspectionService.ts S19
   */
  getFullCredentials(id: string): NetworkDeviceCredentials | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, vendor, ssh_port, username, password, enable_password
      FROM network_devices WHERE id = ?
    `).get(id) as NetworkDeviceCredentials | undefined;
  },

  /**
   * 按 id 获取连接凭证（7 字段，不含 enable_password）
   * 对应 lldpDiscoveryService.ts S28 / configBackupService.ts S35
   */
  getConnectionCredentials(id: string): NetworkDeviceCredentials | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, vendor, ssh_port, username, password
      FROM network_devices WHERE id = ?
    `).get(id) as NetworkDeviceCredentials | undefined;
  },

  /**
   * 按 id 获取测试连接所需字段（6 字段，不含 vendor/enable_password）
   * 对应 networkDeviceService.ts S4
   */
  getTestConnectionFields(id: string): {
    id: string; name: string; ip_address: string; ssh_port: number; username: string | null; password: string | null;
  } | undefined {
    return db.prepare('SELECT id, name, ip_address, ssh_port, username, password FROM network_devices WHERE id = ?')
      .get(id) as { id: string; name: string; ip_address: string; ssh_port: number; username: string | null; password: string | null } | undefined;
  },

  /**
   * 按 id 获取 SSH 凭证子集（3 字段）
   * 对应 verificationGates.ts S13 / remediationExecutor.ts S14 / probeExecutor.ts S16
   */
  getSshCredentials(id: string): NetworkDeviceSshCredentials | undefined {
    return db.prepare('SELECT username, password, ssh_port FROM network_devices WHERE id = ?')
      .get(id) as NetworkDeviceSshCredentials | undefined;
  },

  /**
   * 按 id 获取告警自动分析所需 SSH 凭证（7 字段，含 enable_password）
   * 对应 alertAutoAnalyzer.ts S38
   */
  getAlertAnalysisCredentials(id: string): {
    id: string; name: string; ip_address: string; username: string | null; password: string | null; ssh_port: number; enable_password: string | null;
  } | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, username, password, ssh_port, enable_password
      FROM network_devices WHERE id = ?
    `).get(id) as { id: string; name: string; ip_address: string; username: string | null; password: string | null; ssh_port: number; enable_password: string | null } | undefined;
  },

  /**
   * 按 id 获取 community（SNMP 探针执行用）
   * 对应：probeExecutor.executeSnmpProbe
   */
  getCommunity(id: string): string | undefined {
    const row = db.prepare('SELECT community FROM network_devices WHERE id = ?').get(id) as { community?: string } | undefined;
    return row?.community;
  },

  /**
   * 按 ip 查询拓扑邻居（JOIN topology_links）
   * 对应：deviceProfiler.lookupTopology
   */
  getTopologyNeighborByIp(ip: string): { id: string; name: string; ip_address: string; username: string | null } | undefined {
    return db.prepare(`
      SELECT d.id, d.name, d.ip_address, d.username
      FROM network_devices d
      JOIN topology_links t ON t.source_device_id = d.id OR t.target_device_id = d.id
      WHERE t.source_ip = ? OR t.target_ip = ?
      LIMIT 1
    `).get(ip, ip) as { id: string; name: string; ip_address: string; username: string | null } | undefined;
  },

  /**
   * 按 ip 查询 devices 表（DC 设备表 fallback）
   * 对应：deviceProfiler.lookupTopology
   */
  getDcDeviceByIp(ip: string): { id: string; name: string; ip_address: string; device_type: string } | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, device_type FROM devices WHERE ip_address = ? LIMIT 1
    `).get(ip) as { id: string; name: string; ip_address: string; device_type: string } | undefined;
  },

  /**
   * 按 ip 获取告警自动分析所需 SSH 凭证（7 字段）
   * 对应 alertAutoAnalyzer.ts S39
   */
  getAlertAnalysisCredentialsByIp(ip: string): {
    id: string; name: string; ip_address: string; username: string | null; password: string | null; ssh_port: number; enable_password: string | null;
  } | undefined {
    return db.prepare(`
      SELECT id, name, ip_address, username, password, ssh_port, enable_password
      FROM network_devices WHERE ip_address = ? AND username IS NOT NULL AND username != ?
    `).get(ip, '') as { id: string; name: string; ip_address: string; username: string | null; password: string | null; ssh_port: number; enable_password: string | null } | undefined;
  },

  // ── SELECT：聚合 ──

  /**
   * 统计设备总数
   * 对应 linkageRoutes.ts S34
   */
  countAll(): number {
    const row = db.prepare('SELECT COUNT(*) as c FROM network_devices').get() as { c: number };
    return row.c;
  },

  // ── INSERT ──

  /**
   * 创建设备（17 字段完整 INSERT）
   * 对应 networkDeviceService.ts I1
   * 业务层应已处理：ssh_key 解析、密码加密、默认值填充
   */
  create(input: NetworkDeviceCreateInput): void {
    db.prepare(`
      INSERT INTO network_devices
      (id, name, ip_address, vendor, model, os_version, ssh_port, ssh_key_id, username, password,
       enable_password, location, role, status, snmp_enabled, snmp_credential_id, snmp_port)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.name,
      input.ip_address,
      input.vendor,
      input.model ?? null,
      input.os_version ?? null,
      input.ssh_port ?? 22,
      input.ssh_key_id ?? null,
      input.username ?? null,
      input.password ?? null,
      input.enable_password ?? null,
      input.location ?? null,
      input.role ?? null,
      input.status ?? 'online',
      input.snmp_enabled ?? 1,
      input.snmp_credential_id ?? null,
      input.snmp_port ?? 161
    );
  },

  /**
   * 设备发现导入（简化 INSERT，9 字段）
   * 对应 networkDiscoveryService.ts I2
   */
  createFromDiscovery(input: NetworkDeviceDiscoveryInput): void {
    db.prepare(`
      INSERT INTO network_devices (id, name, ip_address, vendor, model, username, ssh_port, status, os_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.ip_address,
      input.vendor,
      input.model ?? null,
      input.username ?? null,
      input.ssh_port ?? 22,
      input.status ?? 'online',
      input.os_version ?? null
    );
  },

  // ── UPDATE ──

  /**
   * 动态更新设备字段（构建 SET 子句）
   * 对应 networkDeviceService.ts U1
   * 业务层应已处理：密码加密、空密码保护（'' 不更新）、snmp_enabled 转 1/0、falsy → null
   */
  update(id: string, fields: NetworkDeviceUpdateInput): number {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { setClauses.push('name = ?'); values.push(fields.name); }
    if (fields.model !== undefined) { setClauses.push('model = ?'); values.push(fields.model); }
    if (fields.os_version !== undefined) { setClauses.push('os_version = ?'); values.push(fields.os_version); }
    if (fields.ssh_port !== undefined) { setClauses.push('ssh_port = ?'); values.push(fields.ssh_port); }
    if (fields.ssh_key_id !== undefined) { setClauses.push('ssh_key_id = ?'); values.push(fields.ssh_key_id); }
    if (fields.username !== undefined) { setClauses.push('username = ?'); values.push(fields.username); }
    if (fields.password !== undefined) { setClauses.push('password = ?'); values.push(fields.password); }
    if (fields.enable_password !== undefined) { setClauses.push('enable_password = ?'); values.push(fields.enable_password); }
    if (fields.location !== undefined) { setClauses.push('location = ?'); values.push(fields.location); }
    if (fields.role !== undefined) { setClauses.push('role = ?'); values.push(fields.role); }
    if (fields.snmp_enabled !== undefined) { setClauses.push('snmp_enabled = ?'); values.push(fields.snmp_enabled); }
    if (fields.snmp_credential_id !== undefined) { setClauses.push('snmp_credential_id = ?'); values.push(fields.snmp_credential_id); }
    if (fields.snmp_port !== undefined) { setClauses.push('snmp_port = ?'); values.push(fields.snmp_port); }

    if (setClauses.length === 0) return 0;

    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);

    const result = db.prepare(`UPDATE network_devices SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return (result as { changes: number }).changes;
  },

  /**
   * 更新巡检结果（本地时间）
   * 对应 networkInspectionService.ts U2
   */
  updateInspectionResult(id: string, summary: string): void {
    db.prepare(`
      UPDATE network_devices
      SET last_inspection_at = datetime('now','localtime'), last_inspection_result = ?
      WHERE id = ?
    `).run(summary, id);
  },

  /**
   * 更新最近备份时间
   * 对应 configBackupService.ts U4
   */
  updateLastBackupAt(id: string): void {
    db.prepare("UPDATE network_devices SET last_backup_at = datetime('now','localtime') WHERE id = ?").run(id);
  },

  // ── DELETE ──

  /**
   * 按 id 删除设备
   * 对应 networkDeviceService.ts D1
   * 返回是否实际删除了记录
   */
  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM network_devices WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  },

  // ── Schema migration ──

  /** 确保 snmp_credential_id 列存在（运行时 ALTER，幂等） */
  ensureSnmpCredIdColumn(): void {
    try {
      const cols = db.prepare("PRAGMA table_info('network_devices')").all() as { name: string }[];
      if (!cols.find(c => c.name === 'snmp_credential_id')) {
        db.exec('ALTER TABLE network_devices ADD COLUMN snmp_credential_id TEXT REFERENCES snmp_credentials(id) ON DELETE SET NULL');
      }
    } catch { /* 表可能还不存在 */ }
  },
};