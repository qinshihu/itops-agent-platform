/**
 * dockerEndpointRepository — docker_endpoints 表数据访问层
 *
 * 覆盖表：docker_endpoints (v046)
 */

import db from '../../models/database';

// ── 类型定义 ──

export interface DockerEndpointRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  tls_ca: string | null;
  tls_cert: string | null;
  tls_key: string | null;
  status: string;
  error_message: string | null;
  containers_running: number;
  containers_total: number;
  images: number;
  cpu_count: number;
  memory_limit: number;
  created_at: string;
  updated_at: string;
}

export interface DockerEndpointCreateInput {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol?: string;
  tls_ca?: string | null;
  tls_cert?: string | null;
  tls_key?: string | null;
  status?: string;
  containers_running?: number;
  containers_total?: number;
  images?: number;
  cpu_count?: number;
  memory_limit?: number;
}

// ── repository 实现 ──

export const dockerEndpointRepository = {
  listByStatus(status: string): DockerEndpointRecord[] {
    return db.prepare('SELECT * FROM docker_endpoints WHERE status = ? ORDER BY name').all(status) as DockerEndpointRecord[];
  },

  create(input: DockerEndpointCreateInput): void {
    db.prepare(`
      INSERT INTO docker_endpoints (
        id, name, host, port, protocol, tls_ca, tls_cert, tls_key,
        status, error_message, containers_running, containers_total,
        images, cpu_count, memory_limit, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))
    `).run(
      input.id,
      input.name,
      input.host,
      input.port,
      input.protocol ?? 'http',
      input.tls_ca ?? null,
      input.tls_cert ?? null,
      input.tls_key ?? null,
      input.status ?? 'unknown',
      null,
      input.containers_running ?? 0,
      input.containers_total ?? 0,
      input.images ?? 0,
      input.cpu_count ?? 0,
      input.memory_limit ?? 0,
    );
  },

  update(id: string, fields: Record<string, unknown>): void {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && key !== 'id') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE docker_endpoints SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },

  delete(id: string): void {
    db.prepare('DELETE FROM docker_endpoints WHERE id = ?').run(id);
  },

  getById(id: string): DockerEndpointRecord | undefined {
    return db.prepare('SELECT * FROM docker_endpoints WHERE id = ?').get(id) as DockerEndpointRecord | undefined;
  },

  list(): DockerEndpointRecord[] {
    return db.prepare('SELECT * FROM docker_endpoints ORDER BY name').all() as DockerEndpointRecord[];
  },

  updateStatus(id: string, status: string, stats?: { containersRunning?: number; containersTotal?: number; images?: number; cpuCount?: number; memoryLimit?: number; errorMessage?: string | null }): void {
    const setClauses: string[] = ['status = ?'];
    const values: unknown[] = [status];

    if (stats) {
      if (stats.containersRunning !== undefined) { setClauses.push('containers_running = ?'); values.push(stats.containersRunning); }
      if (stats.containersTotal !== undefined) { setClauses.push('containers_total = ?'); values.push(stats.containersTotal); }
      if (stats.images !== undefined) { setClauses.push('images = ?'); values.push(stats.images); }
      if (stats.cpuCount !== undefined) { setClauses.push('cpu_count = ?'); values.push(stats.cpuCount); }
      if (stats.memoryLimit !== undefined) { setClauses.push('memory_limit = ?'); values.push(stats.memoryLimit); }
      if (stats.errorMessage !== undefined) { setClauses.push('error_message = ?'); values.push(stats.errorMessage); }
    }

    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);

    db.prepare(`UPDATE docker_endpoints SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  },
};