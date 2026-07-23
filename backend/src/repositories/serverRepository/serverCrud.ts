import db from '../../models/database';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ServerCommandHistory, ComplianceCheck, ServerMetric } from '../types/server';
import type { ServerRecord, ServerCreateInput, ServerUpdateInput } from './types';

// ── servers 子 repository ──

export const serversRepo = {
  /** 列出全部服务器（按创建时间倒序） */
  list(): ServerRecord[] {
    return db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all() as ServerRecord[];
  },

  /**
   * MCP 工具查询（支持 groupId/status/search 过滤 + limit）
   * 对应：toolDefinitions server.list
   */
  listWithFilters(filters: { groupId?: string; status?: string; search?: string; limit?: number }): ServerRecord[] {
    let query = 'SELECT id, name, hostname, port, status, group_id, os, cpu_cores, memory_gb, last_checked FROM servers WHERE 1=1';
    const params: unknown[] = [];
    if (filters.groupId) { query += ' AND group_id = ?'; params.push(filters.groupId); }
    if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
    if (filters.search) { query += ' AND (name LIKE ? OR hostname LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }
    query += ` LIMIT ${filters.limit || 50}`;
    return db.prepare(query).all(...params) as ServerRecord[];
  },

  /** 列出启用的服务器 */
  listEnabled(): ServerRecord[] {
    return db.prepare('SELECT * FROM servers WHERE enabled = 1 ORDER BY created_at DESC').all() as ServerRecord[];
  },

  /** 列出服务器的轻量字段（id/name/hostname，用于下拉选择） */
  listSummary(): Array<{ id: string; name: string; hostname: string }> {
    return db.prepare('SELECT id, name, hostname FROM servers ORDER BY name ASC').all() as Array<{ id: string; name: string; hostname: string }>;
  },

  /** 按 ID 查询 */
  getById(id: string): ServerRecord | undefined {
    return db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as ServerRecord | undefined;
  },

  /** 按 hostname 查询 */
  getByHostname(hostname: string): ServerRecord | undefined {
    return db.prepare('SELECT * FROM servers WHERE hostname = ?').get(hostname) as ServerRecord | undefined;
  },

  /**
   * 按 IP 查询（匹配 hostname / ip_address / private_ip 三字段）
   * 用于告警联动设备查找
   */
  getByIp(ip: string): ServerRecord | undefined {
    return db.prepare(
      'SELECT * FROM servers WHERE hostname = ? OR ip_address = ? OR private_ip = ?'
    ).get(ip, ip, ip) as ServerRecord | undefined;
  },

  // ── 告警设备解析专用查询（返回 id/hostname 轻量字段集）──

  /**
   * 按主机名精确/模糊匹配服务器（告警设备解析：精确主机名）
   * 对应：alertDeviceResolver.matchByHostname 策略 1
   */
  findIdHostnameByHostname(hostname: string, like1: string, like2: string): { id: string; hostname: string } | undefined {
    return db.prepare(
      'SELECT id, hostname FROM servers WHERE hostname = ? OR hostname LIKE ? OR hostname LIKE ?'
    ).get(hostname, like1, like2) as { id: string; hostname: string } | undefined;
  },

  /**
   * 按主机名模糊匹配服务器（告警设备解析：模糊主机名前缀）
   * 对应：alertDeviceResolver.matchByHostname 策略 3
   */
  findIdHostnameByHostnameFuzzy(likePattern: string, hostname: string): { id: string; hostname: string } | undefined {
    return db.prepare(
      "SELECT id, hostname FROM servers WHERE hostname LIKE ? OR ? LIKE CONCAT('%', hostname) LIMIT 1"
    ).get(likePattern, hostname) as { id: string; hostname: string } | undefined;
  },

  /**
   * 按 IP 或主机名匹配服务器（告警设备解析：IP 地址匹配）
   * 对应：alertDeviceResolver.matchByContentIP
   */
  findIdHostnameByIpOrHostname(ip: string, likePattern: string): { id: string; hostname: string } | undefined {
    return db.prepare(
      'SELECT id, hostname FROM servers WHERE ip_address = ? OR hostname LIKE ?'
    ).get(ip, likePattern) as { id: string; hostname: string } | undefined;
  },

  /**
   * 按主机名 LIKE 匹配服务器（告警设备解析：标题关键词匹配）
   * 对应：alertDeviceResolver.matchByTitleKeywords
   */
  findIdHostnameByHostnameLike(likePattern: string): { id: string; hostname: string } | undefined {
    return db.prepare(
      'SELECT id, hostname FROM servers WHERE hostname LIKE ? LIMIT 1'
    ).get(likePattern) as { id: string; hostname: string } | undefined;
  },

  /**
   * 按 ID 获取 id/hostname（告警设备关联：获取设备名）
   * 对应：alertDeviceResolver.getDeviceForAlert
   */
  getIdHostnameById(id: string): { id: string; hostname: string } | undefined {
    return db.prepare('SELECT id, hostname FROM servers WHERE id = ?')
      .get(id) as { id: string; hostname: string } | undefined;
  },

  /** 按 SSH key ID 查询使用该 key 的服务器 */
  listBySshKeyId(sshKeyId: string): Array<{ id: string; name: string; hostname: string }> {
    return db.prepare('SELECT id, name, hostname FROM servers WHERE ssh_key_id = ?').all(sshKeyId) as Array<{ id: string; name: string; hostname: string }>;
  },

  /** 按 ID 检查存在性（轻量） */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT 1 FROM servers WHERE id = ?').get(id);
    return !!row;
  },

  /** 按 ID 获取 VNC 配置（hostname, vnc_port, vnc_password） */
  getVncConfig(id: string): { hostname: string; vnc_port: number; vnc_password: string | null } | undefined {
    return db.prepare('SELECT hostname, vnc_port, vnc_password FROM servers WHERE id = ?')
      .get(id) as { hostname: string; vnc_port: number; vnc_password: string | null } | undefined;
  },

  /** 更新 VNC 配置（vnc_port / vnc_password 任选其一或同时更新，自动更新 updated_at） */
  updateVncConfig(id: string, input: { vnc_port?: number; vnc_password?: string | null }): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (input.vnc_port !== undefined) {
      setClauses.push('vnc_port = ?');
      values.push(input.vnc_port);
    }
    if (input.vnc_password !== undefined) {
      setClauses.push('vnc_password = ?');
      values.push(input.vnc_password);
    }

    if (setClauses.length === 0) return;

    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE servers SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  /** 统计总数 */
  countAll(): number {
    return (db.prepare('SELECT COUNT(*) as c FROM servers').get() as { c: number }).c;
  },

  /** 统计启用数 */
  countEnabled(): number {
    return (db.prepare('SELECT COUNT(*) as c FROM servers WHERE enabled = 1').get() as { c: number }).c;
  },

  /** 创建服务器 */
  create(input: ServerCreateInput): void {
    db.prepare(
      `INSERT INTO servers (id, name, hostname, port, username, password, private_key, use_ssh_key, description, tags, os_type, ssh_key_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      input.id, input.name, input.hostname, input.port || 22, input.username,
      input.password ?? null, input.private_key ?? null, input.use_ssh_key ? 1 : 0,
      input.description ?? null, input.tags ?? null, input.os_type || 'linux', input.ssh_key_id ?? null
    );
  },

  /**
   * 更新服务器（COALESCE 部分更新，与 serverRoutes.ts 原有语义一致）
   * password/private_key 使用 CASE 判断是否更新
   */
  update(id: string, input: ServerUpdateInput): void {
    const passwordVal = input.password !== undefined ? input.password : undefined;
    const privateKeyVal = input.private_key !== undefined ? input.private_key : undefined;
    // description: undefined=不更新 / null=清空 / string=更新（与 password 模式一致）
    const descriptionVal = input.description !== undefined ? input.description : undefined;
    // tags: undefined=不更新 / null=清空 / string=更新
    const tagsVal = input.tags !== undefined ? input.tags : undefined;

    db.prepare(
      `UPDATE servers
       SET name = COALESCE(?, name),
           hostname = COALESCE(?, hostname),
           port = COALESCE(?, port),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           use_ssh_key = COALESCE(?, use_ssh_key),
           description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END,
           tags = CASE WHEN ? IS NOT NULL THEN ? ELSE tags END,
           enabled = COALESCE(?, enabled),
           os_type = COALESCE(?, os_type),
           ssh_key_id = COALESCE(?, ssh_key_id),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      input.name ?? null,
      input.hostname ?? null,
      input.port ?? null,
      input.username ?? null,
      passwordVal,
      passwordVal,
      privateKeyVal,
      privateKeyVal,
      input.use_ssh_key ?? null,
      descriptionVal,
      descriptionVal,
      tagsVal,
      tagsVal,
      input.enabled ?? null,
      input.os_type ?? null,
      input.ssh_key_id ?? null,
      id
    );
  },

  /** 删除服务器 */
  delete(id: string): void {
    db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  },

  // ── 关联表：server_command_history ──

  /** 列出服务器命令历史（limit=0 表示全部） */
  listCommandHistory(serverId: string, limit = 50): ServerCommandHistory[] {
    if (limit > 0) {
      return db.prepare(
        'SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC LIMIT ?'
      ).all(serverId, limit) as ServerCommandHistory[];
    }
    return db.prepare(
      'SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC'
    ).all(serverId) as ServerCommandHistory[];
  },

  // ── 关联表：compliance_checks ──

  /** 列出合规检查历史（limit=0 表示全部） */
  listComplianceChecks(serverId: string, limit = 20): ComplianceCheck[] {
    if (limit > 0) {
      return db.prepare(
        'SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(serverId, limit) as ComplianceCheck[];
    }
    return db.prepare(
      'SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC'
    ).all(serverId) as ComplianceCheck[];
  },

  // ── 写入 server_command_history ──

  /** 插入命令历史记录 */
  insertCommandHistory(input: {
    id: string;
    server_id: string;
    command: string;
    stdout: string;
    stderr: string;
    success: number;
    execution_time_ms: number;
    executed_by: string;
  }): void {
    db.prepare(`
      INSERT INTO server_command_history
      (id, server_id, command, stdout, stderr, success, execution_time_ms, executed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(input.id, input.server_id, input.command, input.stdout, input.stderr, input.success, input.execution_time_ms, input.executed_by);
  },

  /** 更新服务器最后连接时间 */
  updateLastConnected(serverId: string): void {
    db.prepare("UPDATE servers SET last_connected = datetime('now','localtime') WHERE id = ?").run(serverId);
  },

  // ── 写入 compliance_checks ──

  /** 插入合规检查记录 */
  insertComplianceCheck(input: {
    id: string;
    server_id: string;
    check_name: string;
    check_results: string;
    status: string;
    started_at: string;
  }): void {
    db.prepare(`
      INSERT INTO compliance_checks
      (id, server_id, check_name, check_results, status, started_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(input.id, input.server_id, input.check_name, input.check_results, input.status, input.started_at);
  },

  /** 更新合规检查结果（完成） */
  updateComplianceCheck(id: string, checkResults: string): void {
    db.prepare(`
      UPDATE compliance_checks
      SET check_results = ?, status = 'completed', completed_at = datetime('now','localtime')
      WHERE id = ?
    `).run(checkResults, id);
  },

  /** 更新服务器 OS 类型 */
  updateOsType(serverId: string, osType: string): void {
    db.prepare('UPDATE servers SET os_type = ? WHERE id = ?').run(osType, serverId);
  },

  /** 更新服务器系统信息（采集结果） */
  updateSystemInfo(serverId: string, info: {
    os: string;
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    ip_address: string;
    private_ip: string;
    os_type: string;
  }): void {
    db.prepare(`
      UPDATE servers
      SET os = ?, cpu_cores = ?, memory_gb = ?, disk_gb = ?,
          ip_address = ?, private_ip = ?, os_type = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(info.os, info.cpu_cores, info.memory_gb, info.disk_gb, info.ip_address, info.private_ip, info.os_type, serverId);
  },

  // ── 导入用 ──

  /** 按 hostname + port 检查重复 */
  checkDuplicateByHostnameAndPort(hostname: string, port: number): { id: string } | undefined {
    return db.prepare('SELECT id FROM servers WHERE hostname = ? AND port = ?')
      .get(hostname, port) as { id: string } | undefined;
  },

  /** 按 hostname + name 检查重复（导入用） */
  existsByHostnameAndName(hostname: string, name: string): boolean {
    const row = db.prepare('SELECT id FROM servers WHERE hostname = ? AND name = ?').get(hostname, name);
    return !!row;
  },

  /** 批量创建服务器（事务内，导入用） */
  bulkCreate(rows: Array<Record<string, unknown>>): void {
    const stmt = db.prepare(`
      INSERT INTO servers (id, name, hostname, port, username, password, private_key, use_ssh_key, description, tags, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const txn = db.transaction((rws: unknown[]) => {
      for (const row of rws) {
        const r = row as Record<string, unknown>;
        stmt.run(r.id, r.name, r.hostname, r.port || 22, r.username,
          r.password ?? null, r.private_key ?? null, r.use_ssh_key ? 1 : 0,
          r.description ?? null, r.tags ?? null, r.enabled !== undefined ? r.enabled : 1);
      }
    });
    txn(rows as unknown[]);
  },

  /** 导出全部服务器（含系统信息字段） */
  listAllForExport(): Array<Record<string, unknown>> {
    return db.prepare(`
      SELECT id, name, hostname, port, username, description, tags, enabled, 
             os, cpu_cores, memory_gb, disk_gb, ip_address, created_at
      FROM servers 
      ORDER BY created_at DESC
    `).all() as Array<Record<string, unknown>>;
  },

  /** 导入服务器（完整 INSERT，含加密后的 password/private_key） */
  insertImport(input: {
    id: string; name: string; hostname: string; port: number; username: string;
    password: string | null; private_key: string | null; use_ssh_key: number;
    description: string | null; tags: string | null;
  }): void {
    db.prepare(`
      INSERT INTO servers (id, name, hostname, port, username, password, private_key, use_ssh_key, description, tags, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      input.id, input.name, input.hostname, input.port, input.username,
      input.password, input.private_key, input.use_ssh_key,
      input.description, input.tags
    );
  },

  /** 添加服务器分组映射（幂等） */
  addGroupMapping(serverId: string, groupId: string): void {
    db.prepare('INSERT OR IGNORE INTO server_group_mapping (server_id, group_id) VALUES (?, ?)')
      .run(serverId, groupId);
  },

  /** 按 serverId 删除全部分组映射 */
  removeGroupMappingByServerId(serverId: string): void {
    db.prepare('DELETE FROM server_group_mapping WHERE server_id = ?').run(serverId);
  },

  // ── 采集 / 指标 ──

  /** 插入服务器指标采集记录 */
  insertMetrics(input: {
    id: string; server_id: string;
    cpu_usage: number; memory_usage: number; memory_total_gb: number; memory_used_gb: number;
    disk_usage: number; disk_total_gb: number; disk_used_gb: number;
    network_in_mbps: number; network_out_mbps: number;
    load_1min: number; load_5min: number; load_15min: number;
    uptime_seconds: number;
  }): void {
    db.prepare(`
      INSERT INTO server_metrics (
        id, server_id, cpu_usage, memory_usage, memory_total_gb, memory_used_gb,
        disk_usage, disk_total_gb, disk_used_gb, network_in_mbps, network_out_mbps,
        load_1min, load_5min, load_15min, uptime_seconds, collected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      input.id, input.server_id,
      input.cpu_usage, input.memory_usage, input.memory_total_gb, input.memory_used_gb,
      input.disk_usage, input.disk_total_gb, input.disk_used_gb,
      input.network_in_mbps, input.network_out_mbps,
      input.load_1min, input.load_5min, input.load_15min,
      input.uptime_seconds
    );
  },

  // ── 加密迁移用 ──

  /** 列出所有服务器的凭据（id + 加密字段） */
  listCredentialsForMigration(): Array<{ id: string; password: string | null; private_key: string | null }> {
    return db.prepare('SELECT id, password, private_key FROM servers')
      .all() as Array<{ id: string; password: string | null; private_key: string | null }>;
  },

  /** 直接更新服务器凭据字段（加密迁移用） */
  updateCredentials(id: string, password: string | null, privateKey: string | null): void {
    db.prepare("UPDATE servers SET password = ?, private_key = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(password, privateKey, id);
  },

  // ── 加密密钥管理 ──

  /** 获取活跃的加密密钥 */
  getActiveEncryptionKey(keyType: string): string | undefined {
    const row = db.prepare('SELECT key_value FROM encryption_keys WHERE key_type = ? AND active = 1 LIMIT 1')
      .get(keyType) as { key_value: string } | undefined;
    return row?.key_value;
  },

  /** 停用指定类型的加密密钥 */
  deactivateEncryptionKeys(keyType: string): void {
    db.prepare('UPDATE encryption_keys SET active = 0 WHERE key_type = ?').run(keyType);
  },

  /** 在事务中执行回调 */
  transaction<T>(fn: () => T): T {
    const txn = db.transaction(fn);
    return txn();
  },
};