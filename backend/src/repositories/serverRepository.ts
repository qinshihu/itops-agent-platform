/**
 * serverRepository — servers / server_groups / server_group_mapping / ssh_keys 表的统一数据访问层
 *
 * 采用 dcRepository 的子 repository 聚合模式：
 *   - serversRepo  (servers)
 *   - groupsRepo   (server_groups + server_group_mapping)
 *   - sshKeysRepo  (ssh_keys)
 *
 * 取代 serverRoutes.ts / serverGroupRoutes.ts / sshKeyRoutes.ts 等散落的 db.prepare 调用。
 */

import db from '../models/database';

// ── servers 表类型 ──

export interface ServerRecord {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  password?: string | null;
  private_key?: string | null;
  use_ssh_key: number;
  description?: string | null;
  tags?: string | null;
  enabled: number;
  last_connected?: string | null;
  os?: string | null;
  os_type: string;
  cpu_cores?: number | null;
  memory_gb?: number | null;
  disk_gb?: number | null;
  ip_address?: string | null;
  private_ip?: string | null;
  cloud_provider?: string | null;
  cloud_instance_id?: string | null;
  vnc_port: number;
  vnc_password?: string | null;
  ssh_key_id?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ServerCreateInput {
  id: string;
  name: string;
  hostname: string;
  port?: number;
  username: string;
  password?: string | null;
  private_key?: string | null;
  use_ssh_key?: number;
  description?: string | null;
  tags?: string | null;
  os_type?: string;
  ssh_key_id?: string | null;
}

export interface ServerUpdateInput {
  name?: string;
  hostname?: string;
  port?: number;
  username?: string;
  password?: string | null;
  private_key?: string | null;
  use_ssh_key?: number;
  description?: string | null;
  tags?: string | null;
  enabled?: number;
  os_type?: string;
  ssh_key_id?: string | null;
}

// ── servers 子 repository ──

export const serversRepo = {
  /** 列出全部服务器（按创建时间倒序） */
  list(): ServerRecord[] {
    return db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all() as ServerRecord[];
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

    db.prepare(
      `UPDATE servers
       SET name = COALESCE(?, name),
           hostname = COALESCE(?, hostname),
           port = COALESCE(?, port),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           use_ssh_key = COALESCE(?, use_ssh_key),
           description = COALESCE(?, description),
           tags = COALESCE(?, tags),
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
      input.description ?? null,
      input.tags ?? null,
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
  listCommandHistory(serverId: string, limit = 50): Array<Record<string, unknown>> {
    if (limit > 0) {
      return db.prepare(
        'SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC LIMIT ?'
      ).all(serverId, limit) as Array<Record<string, unknown>>;
    }
    return db.prepare(
      'SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC'
    ).all(serverId) as Array<Record<string, unknown>>;
  },

  // ── 关联表：compliance_checks ──

  /** 列出合规检查历史（limit=0 表示全部） */
  listComplianceChecks(serverId: string, limit = 20): Array<Record<string, unknown>> {
    if (limit > 0) {
      return db.prepare(
        'SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(serverId, limit) as Array<Record<string, unknown>>;
    }
    return db.prepare(
      'SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC'
    ).all(serverId) as Array<Record<string, unknown>>;
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

// ── server_groups / server_group_mapping 类型 ──

export interface ServerGroupRecord {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ServerGroupCreateInput {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

// ── groups 子 repository ──

export const groupsRepo = {
  /**
   * 列出全部分组（含 server_count / children_count 聚合）
   */
  list(): Array<ServerGroupRecord & { server_count: number; children_count: number }> {
    return db.prepare(`
      SELECT sg.*,
        (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count,
        (SELECT COUNT(*) FROM server_groups WHERE parent_id = sg.id) as children_count
      FROM server_groups sg
      ORDER BY sg.sort_order ASC, sg.created_at ASC
    `).all() as Array<ServerGroupRecord & { server_count: number; children_count: number }>;
  },

  /**
   * 列出分组（含 server_count，不含 children_count，用于树构建）
   */
  listForTree(): Array<ServerGroupRecord & { server_count: number }> {
    return db.prepare(`
      SELECT sg.*,
        (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count
      FROM server_groups sg
      ORDER BY sg.sort_order ASC, sg.created_at ASC
    `).all() as Array<ServerGroupRecord & { server_count: number }>;
  },

  /** 按 ID 查询分组 */
  getById(id: string): ServerGroupRecord | undefined {
    return db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as ServerGroupRecord | undefined;
  },

  /** 按 ID 检查存在性 */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT id FROM server_groups WHERE id = ?').get(id);
    return !!row;
  },

  /** 统计子分组数 */
  countChildren(id: string): number {
    return (db.prepare('SELECT COUNT(*) as c FROM server_groups WHERE parent_id = ?').get(id) as { c: number }).c;
  },

  /** 创建分组 */
  create(input: ServerGroupCreateInput): void {
    db.prepare(`
      INSERT INTO server_groups (id, name, description, parent_id, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.id, input.name, input.description ?? null, input.parent_id ?? null, input.sort_order || 0);
  },

  /** 更新分组（COALESCE 部分更新） */
  update(id: string, input: {
    name?: string;
    description?: string | null;
    parent_id?: string | null;
    sort_order?: number;
  }): void {
    db.prepare(`
      UPDATE server_groups
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          parent_id = COALESCE(?, parent_id),
          sort_order = COALESCE(?, sort_order),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      input.name ?? null,
      input.description !== undefined ? input.description : null,
      input.parent_id !== undefined ? input.parent_id : null,
      input.sort_order !== undefined ? input.sort_order : null,
      id
    );
  },

  /** 移动分组（修改 parent_id 和 sort_order） */
  move(id: string, newParentId: string | null, sortOrder?: number): void {
    db.prepare(`
      UPDATE server_groups
      SET parent_id = ?, sort_order = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newParentId, sortOrder ?? 0, id);
  },

  /** 删除分组（先删映射再删分组） */
  delete(id: string): void {
    db.prepare('DELETE FROM server_group_mapping WHERE group_id = ?').run(id);
    db.prepare('DELETE FROM server_groups WHERE id = ?').run(id);
  },

  // ── server_group_mapping ──

  /** 添加映射（幂等） */
  addMapping(serverId: string, groupId: string): void {
    db.prepare('INSERT OR IGNORE INTO server_group_mapping (server_id, group_id) VALUES (?, ?)').run(serverId, groupId);
  },

  /** 删除映射 */
  removeMapping(serverId: string, groupId: string): void {
    db.prepare('DELETE FROM server_group_mapping WHERE server_id = ? AND group_id = ?').run(serverId, groupId);
  },

  /** 列出服务器所属的分组 */
  listByServer(serverId: string): ServerGroupRecord[] {
    return db.prepare(`
      SELECT sg.* FROM server_groups sg
      JOIN server_group_mapping sgm ON sg.id = sgm.group_id
      WHERE sgm.server_id = ?
      ORDER BY sg.sort_order ASC
    `).all(serverId) as ServerGroupRecord[];
  },

  /** 列出分组下的服务器 */
  listServersByGroup(groupId: string): ServerRecord[] {
    return db.prepare(`
      SELECT s.* FROM servers s
      JOIN server_group_mapping sgm ON s.id = sgm.server_id
      WHERE sgm.group_id = ?
      ORDER BY s.name ASC
    `).all(groupId) as ServerRecord[];
  },
};

// ── ssh_keys 类型 ──

export interface SshKeyRecord {
  id: string;
  name: string;
  auth_type: 'key' | 'password';
  key_type: string;
  fingerprint: string | null;
  username?: string | null;
  password?: string | null;
  private_key?: string | null;
  description?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

// ── sshKeys 子 repository ──

export const sshKeysRepo = {
  /**
   * 列出全部 SSH key（含 usage_count 聚合）
   */
  list(): Array<SshKeyRecord & { usage_count: number }> {
    return db.prepare(`
      SELECT sk.id, sk.name, sk.auth_type, sk.key_type, sk.fingerprint, sk.username, sk.description, sk.created_at, sk.updated_at,
             COUNT(DISTINCT s.id) as usage_count
      FROM ssh_keys sk
      LEFT JOIN servers s ON s.ssh_key_id = sk.id
      GROUP BY sk.id
      ORDER BY sk.created_at DESC
    `).all() as Array<SshKeyRecord & { usage_count: number }>;
  },

  /** 按 ID 查询（含敏感字段） */
  getById(id: string): SshKeyRecord | undefined {
    return db.prepare(
      'SELECT id, name, auth_type, key_type, fingerprint, username, password, private_key, description, created_at, updated_at FROM ssh_keys WHERE id = ?'
    ).get(id) as SshKeyRecord | undefined;
  },

  /** 按名称查询（用于重名检查） */
  findByName(name: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM ssh_keys WHERE name = ?').get(name) as { id: string } | undefined;
  },

  /** 按名称查询（排除自身，用于更新时重名检查） */
  findByNameExcludeId(name: string, excludeId: string): { id: string } | undefined {
    return db.prepare('SELECT id FROM ssh_keys WHERE name = ? AND id != ?').get(name, excludeId) as { id: string } | undefined;
  },

  /** 按 ID 检查存在性 */
  existsById(id: string): boolean {
    const row = db.prepare('SELECT id FROM ssh_keys WHERE id = ?').get(id);
    return !!row;
  },

  /** 统计使用该 key 的服务器数 */
  countUsage(keyId: string): number {
    return (db.prepare('SELECT COUNT(*) as c FROM servers WHERE ssh_key_id = ?').get(keyId) as { c: number }).c;
  },

  /** 列出使用该 key 的服务器 */
  listServersByKey(keyId: string): Array<{ id: string; name: string; hostname: string }> {
    return db.prepare('SELECT id, name, hostname FROM servers WHERE ssh_key_id = ?').all(keyId) as Array<{ id: string; name: string; hostname: string }>;
  },

  /** 创建 SSH key（key 类型） */
  createKey(input: {
    id: string;
    name: string;
    key_type: string;
    fingerprint: string;
    private_key: string;
    description?: string | null;
  }): void {
    db.prepare(
      `INSERT INTO ssh_keys (id, name, auth_type, key_type, fingerprint, private_key, description)
       VALUES (?, ?, 'key', ?, ?, ?, ?)`
    ).run(input.id, input.name, input.key_type, input.fingerprint, input.private_key, input.description ?? null);
  },

  /** 创建 SSH key（password 类型） */
  createPassword(input: {
    id: string;
    name: string;
    username: string;
    password: string;
    description?: string | null;
  }): void {
    db.prepare(
      `INSERT INTO ssh_keys (id, name, auth_type, key_type, username, password, description)
       VALUES (?, ?, 'password', 'password', ?, ?, ?)`
    ).run(input.id, input.name, input.username, input.password, input.description ?? null);
  },

  /**
   * 更新 SSH key（COALESCE + CASE 模式，与 sshKeyRoutes.ts 原有语义一致）
   */
  update(id: string, input: {
    name?: string;
    auth_type?: string;
    key_type?: string;
    fingerprint?: string;
    username?: string | null;
    password?: string | null;
    private_key?: string | null;
    description?: string | null;
  }): void {
    db.prepare(
      `UPDATE ssh_keys
       SET name = COALESCE(?, name),
           auth_type = COALESCE(?, auth_type),
           key_type = COALESCE(?, key_type),
           fingerprint = COALESCE(?, fingerprint),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           description = COALESCE(?, description),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      input.name ?? null,
      input.auth_type ?? null,
      input.key_type ?? null,
      input.fingerprint ?? null,
      input.username ?? null,
      input.password ?? null,
      input.password ?? null,
      input.private_key ?? null,
      input.private_key ?? null,
      input.description ?? null,
      id
    );
  },

  /** 删除 SSH key */
  delete(id: string): void {
    db.prepare('DELETE FROM ssh_keys WHERE id = ?').run(id);
  },
};

// ── 聚合导出（兼容 serverRepository.* 调用风格）──

export const serverRepository = {
  servers: serversRepo,
  groups: groupsRepo,
  sshKeys: sshKeysRepo,
};

// ── service_topologies 子 repository ──

export const topologyRepo = {
  /** 获取依赖（JOIN servers 获取名称/IP） */
  getDependencies(serverId: string): Array<Record<string, unknown>> {
    return db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
      WHERE st.source_server_id = ? OR st.target_server_id = ?
    `).all(serverId, serverId) as Array<Record<string, unknown>>;
  },

  /** 获取全部依赖（JOIN servers） */
  getAllDependencies(): Array<Record<string, unknown>> {
    return db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
    `).all() as Array<Record<string, unknown>>;
  },

  /** 获取活跃依赖 */
  getActiveDependencies(): Array<Record<string, unknown>> {
    return db.prepare("SELECT * FROM service_topologies WHERE status = 'active'").all() as Array<Record<string, unknown>>;
  },

  /** 按 ID 获取单条依赖 */
  getDependencyById(id: string): Record<string, unknown> | undefined {
    return db.prepare('SELECT * FROM service_topologies WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  },

  /** 插入依赖关系 */
  insertDependency(input: {
    id: string; source_server_id: string; target_server_id: string; dependency_type: string;
    protocol?: string | null; port?: number | null; metadata?: string | null;
    created_at: string; updated_at: string;
  }): void {
    db.prepare(`
      INSERT INTO service_topologies (id, source_server_id, target_server_id, dependency_type, protocol, port, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(input.id, input.source_server_id, input.target_server_id, input.dependency_type,
      input.protocol ?? null, input.port ?? null, input.metadata ?? null, input.created_at, input.updated_at);
  },

  /** 更新依赖验证状态 */
  updateDependencyVerification(id: string, status: string, verifiedAt: string, updatedAt: string): void {
    db.prepare('UPDATE service_topologies SET status = ?, last_verified_at = ?, updated_at = ? WHERE id = ?')
      .run(status, verifiedAt, updatedAt, id);
  },

  /** 删除依赖 */
  deleteDependency(id: string): number {
    const result = db.prepare('DELETE FROM service_topologies WHERE id = ?').run(id);
    return (result as { changes: number }).changes;
  },

  /** 上游依赖（BFS 用） */
  getUpstreamDependencies(serverId: string): Array<Record<string, unknown>> {
    return db.prepare(`
      SELECT st.*, s.name as source_name, s.hostname as source_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.source_server_id = s.id
      WHERE st.target_server_id = ? AND st.status = 'active'
    `).all(serverId) as Array<Record<string, unknown>>;
  },

  /** 下游依赖（BFS 用） */
  getDownstreamDependencies(serverId: string): Array<Record<string, unknown>> {
    return db.prepare(`
      SELECT st.*, s.name as target_name, s.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.target_server_id = s.id
      WHERE st.source_server_id = ? AND st.status = 'active'
    `).all(serverId) as Array<Record<string, unknown>>;
  },
};
