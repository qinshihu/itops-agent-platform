import db from '../../models/database';
import type { ServiceTopology } from '../types/server';

// ── service_topologies 子 repository ──

export const topologyRepo = {
  /** 获取某服务器的依赖（JOIN servers 获取名称/IP） */
  getDependencies(serverId: string): Array<ServiceTopology & { source_name?: string; source_ip?: string; target_name?: string; target_ip?: string }> {
    return db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
      WHERE st.source_server_id = ? OR st.target_server_id = ?
    `).all(serverId, serverId) as Array<ServiceTopology & { source_name?: string; source_ip?: string; target_name?: string; target_ip?: string }>;
  },

  /** 获取全部依赖（JOIN servers） */
  getAllDependencies(): Array<ServiceTopology & { source_name?: string; source_ip?: string; target_name?: string; target_ip?: string }> {
    return db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
    `).all() as Array<ServiceTopology & { source_name?: string; source_ip?: string; target_name?: string; target_ip?: string }>;
  },

  /** 获取活跃依赖 */
  getActiveDependencies(): ServiceTopology[] {
    return db.prepare("SELECT * FROM service_topologies WHERE status = 'active'").all() as ServiceTopology[];
  },

  /** 按 ID 获取单条依赖 */
  getDependencyById(id: string): ServiceTopology | undefined {
    return db.prepare('SELECT * FROM service_topologies WHERE id = ?').get(id) as ServiceTopology | undefined;
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
  getUpstreamDependencies(serverId: string): Array<ServiceTopology & { source_name?: string; source_ip?: string }> {
    return db.prepare(`
      SELECT st.*, s.name as source_name, s.hostname as source_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.source_server_id = s.id
      WHERE st.target_server_id = ? AND st.status = 'active'
    `).all(serverId) as Array<ServiceTopology & { source_name?: string; source_ip?: string }>;
  },

  /** 下游依赖（BFS 用） */
  getDownstreamDependencies(serverId: string): Array<ServiceTopology & { target_name?: string; target_ip?: string }> {
    return db.prepare(`
      SELECT st.*, s.name as target_name, s.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.target_server_id = s.id
      WHERE st.source_server_id = ? AND st.status = 'active'
    `).all(serverId) as Array<ServiceTopology & { target_name?: string; target_ip?: string }>;
  },
};