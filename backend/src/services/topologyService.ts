import db from '../models/database';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import { executeCommand } from './sshService';

export interface DependencyInput {
  source_server_id: string;
  target_server_id: string;
  dependency_type: string;
  protocol?: string;
  port?: number;
  metadata?: Record<string, unknown>;
}

export interface TopologyNode {
  id: string;
  server_id: string;
  name?: string;
  server_name?: string;
  ip?: string;
  server_ip?: string;
  status: string;
  type: string;
  x?: number;
  y?: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  dependency_type: string;
  protocol?: string;
  port?: number;
  status: string;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface AffectedService {
  server_id: string;
  server_name?: string;
  server_ip?: string;
  direction: 'upstream' | 'downstream' | 'both';
  distance: number;
  path: string[];
}

interface ServerDB {
  id: string;
  name: string;
  hostname: string;
}

interface DependencyDB {
  id: string;
  source_server_id: string;
  target_server_id: string;
  dependency_type: string;
  protocol: string | null;
  port: number | null;
  status: string;
  last_verified_at: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

class TopologyService {
  async discoverDependencies(serverId: string): Promise<DependencyInput[]> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerDB | undefined;
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const commands = [
      'netstat -tunapl 2>/dev/null || ss -tunapl 2>/dev/null',
      'lsof -i -P -n 2>/dev/null',
      'cat /etc/hosts 2>/dev/null',
    ];

    const discovered: DependencyInput[] = [];
    const allServers = db.prepare('SELECT id, hostname FROM servers').all() as ServerDB[];

    for (const cmd of commands) {
      try {
        const result = await executeCommand(serverId, cmd, { logHistory: false });
        if (result.success && result.stdout) {
          for (const other of allServers) {
            if (other.id === serverId) continue;
            const pattern = new RegExp(`\\b${this.escapeRegExp(other.hostname)}\\b`);
            if (pattern.test(result.stdout)) {
              const dependencyType = cmd.includes('netstat') || cmd.includes('ss') ? 'network' : 'dns';
              discovered.push({
                source_server_id: serverId,
                target_server_id: other.id,
                dependency_type: dependencyType,
                protocol: 'tcp',
                metadata: { discovered_by: 'auto', command: cmd },
              });
            }
          }
        }
      } catch (error) {
        logger.warn(`Dependency discovery command failed for server ${serverId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return discovered;
  }

  addDependency(input: DependencyInput): TopologyEdge {
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO service_topologies (id, source_server_id, target_server_id, dependency_type, protocol, port, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(
      id,
      input.source_server_id,
      input.target_server_id,
      input.dependency_type,
      input.protocol || null,
      input.port || null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now
    );

    return this.edgeToTopologyEdge(this.getDependencyById(id)!);
  }

  getServerTopology(serverId: string): TopologyGraph {
    const server = db.prepare('SELECT id, name, hostname FROM servers WHERE id = ?').get(serverId) as ServerDB | undefined;
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const nodes: TopologyNode[] = [];
    const edges: TopologyEdge[] = [];

    nodes.push({
      id: server.id,
      server_id: server.id,
      name: server.name,
      server_name: server.name,
      ip: server.hostname,
      server_ip: server.hostname,
      status: 'online',
      type: 'server',
    });

    const deps = db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
      WHERE st.source_server_id = ? OR st.target_server_id = ?
    `).all(serverId, serverId) as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    const serverIds = new Set<string>([serverId]);

    for (const dep of deps) {
      edges.push(this.dependencyToEdge(dep));

      if (dep.source_server_id !== serverId && !serverIds.has(dep.source_server_id)) {
        serverIds.add(dep.source_server_id);
        nodes.push({
          id: dep.source_server_id,
          server_id: dep.source_server_id,
          name: dep.source_name || undefined,
          server_name: dep.source_name || undefined,
          ip: dep.source_ip || undefined,
          server_ip: dep.source_ip || undefined,
          status: 'online',
          type: 'server',
        });
      }

      if (dep.target_server_id !== serverId && !serverIds.has(dep.target_server_id)) {
        serverIds.add(dep.target_server_id);
        nodes.push({
          id: dep.target_server_id,
          server_id: dep.target_server_id,
          name: dep.target_name || undefined,
          server_name: dep.target_name || undefined,
          ip: dep.target_ip || undefined,
          server_ip: dep.target_ip || undefined,
          status: 'online',
          type: 'server',
        });
      }
    }

    return { nodes, edges };
  }

  getGlobalTopology(): TopologyGraph {
    const servers = db.prepare('SELECT id, name, hostname FROM servers').all() as ServerDB[];
    const deps = db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
    `).all() as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    const nodes: TopologyNode[] = servers.map(s => ({
      id: s.id,
      server_id: s.id,
      name: s.name,
      server_name: s.name,
      ip: s.hostname,
      server_ip: s.hostname,
      status: 'online',
      type: 'server',
    }));

    const edges: TopologyEdge[] = deps.map(dep => this.dependencyToEdge(dep));

    return { nodes, edges };
  }

  async verifyDependencies(): Promise<Array<{ id: string; source_server_id: string; target_server_id: string; status: string; verified_at: string }>> {
    const deps = db.prepare('SELECT * FROM service_topologies WHERE status = \'active\'').all() as DependencyDB[];
    const results: Array<{ id: string; source_server_id: string; target_server_id: string; status: string; verified_at: string }> = [];

    for (const dep of deps) {
      let status = 'inactive';
      const now = new Date().toISOString();

      try {
        const target = db.prepare('SELECT hostname FROM servers WHERE id = ?').get(dep.target_server_id) as { hostname: string } | undefined;
        if (target) {
          const result = await executeCommand(dep.source_server_id, `ping -c 1 -W 2 ${target.hostname}`, { logHistory: false });
          status = result.success ? 'active' : 'inactive';
        }
      } catch {
        status = 'unknown';
      }

      db.prepare(`
        UPDATE service_topologies SET status = ?, last_verified_at = ?, updated_at = ? WHERE id = ?
      `).run(status, now, now, dep.id);

      results.push({
        id: dep.id,
        source_server_id: dep.source_server_id,
        target_server_id: dep.target_server_id,
        status,
        verified_at: now,
      });
    }

    return results;
  }

  getAffectedServices(alertId: string): { upstream: AffectedService[]; downstream: AffectedService[] } {
    const alert = db.prepare('SELECT server_id FROM alerts WHERE id = ?').get(alertId) as { server_id: string } | undefined;
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const upstream = this.findUpstream(alert.server_id);
    const downstream = this.findDownstream(alert.server_id);

    return { upstream, downstream };
  }

  deleteDependency(id: string): boolean {
    const result = db.prepare('DELETE FROM service_topologies WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getDependenciesByServer(serverId: string): TopologyEdge[] {
    const deps = db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
      WHERE st.source_server_id = ? OR st.target_server_id = ?
    `).all(serverId, serverId) as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    return deps.map(dep => this.dependencyToEdge(dep));
  }

  getAllDependencies(): TopologyEdge[] {
    const deps = db.prepare(`
      SELECT st.*, 
        s1.name as source_name, s1.hostname as source_ip,
        s2.name as target_name, s2.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s1 ON st.source_server_id = s1.id
      LEFT JOIN servers s2 ON st.target_server_id = s2.id
    `).all() as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    return deps.map(dep => this.dependencyToEdge(dep));
  }

  private findUpstream(serverId: string, visited: Set<string> = new Set(), distance = 0, path: string[] = [], maxDepth = 10): AffectedService[] {
    if (visited.has(serverId) || distance >= maxDepth) return [];
    visited.add(serverId);

    const server = db.prepare('SELECT id, name, hostname FROM servers WHERE id = ?').get(serverId) as ServerDB | undefined;
    if (!server) return [];

    const deps = db.prepare(`
      SELECT st.*, s.name as source_name, s.hostname as source_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.source_server_id = s.id
      WHERE st.target_server_id = ? AND st.status = 'active'
    `).all(serverId) as (DependencyDB & { source_name: string | null; source_ip: string | null })[];

    const results: AffectedService[] = [];

    for (const dep of deps) {
      const newPath = [...path, serverId];
      const childResults = this.findUpstream(dep.source_server_id, visited, distance + 1, newPath, maxDepth);

      if (distance === 0) {
        results.push({
          server_id: dep.source_server_id,
          server_name: dep.source_name || undefined,
          server_ip: dep.source_ip || undefined,
          direction: 'upstream',
          distance: 1,
          path: newPath,
        });
      }

      results.push(...childResults);
    }

    return results;
  }

  private findDownstream(serverId: string, visited: Set<string> = new Set(), distance = 0, path: string[] = [], maxDepth = 10): AffectedService[] {
    if (visited.has(serverId) || distance >= maxDepth) return [];
    visited.add(serverId);

    const server = db.prepare('SELECT id, name, hostname FROM servers WHERE id = ?').get(serverId) as ServerDB | undefined;
    if (!server) return [];

    const deps = db.prepare(`
      SELECT st.*, s.name as target_name, s.hostname as target_ip
      FROM service_topologies st
      LEFT JOIN servers s ON st.target_server_id = s.id
      WHERE st.source_server_id = ? AND st.status = 'active'
    `).all(serverId) as (DependencyDB & { target_name: string | null; target_ip: string | null })[];

    const results: AffectedService[] = [];

    for (const dep of deps) {
      const newPath = [...path, serverId];
      const childResults = this.findDownstream(dep.target_server_id, visited, distance + 1, newPath, maxDepth);

      if (distance === 0) {
        results.push({
          server_id: dep.target_server_id,
          server_name: dep.target_name || undefined,
          server_ip: dep.target_ip || undefined,
          direction: 'downstream',
          distance: 1,
          path: newPath,
        });
      }

      results.push(...childResults);
    }

    return results;
  }

  private getDependencyById(id: string): DependencyDB | undefined {
    return db.prepare('SELECT * FROM service_topologies WHERE id = ?').get(id) as DependencyDB | undefined;
  }

  private dependencyToEdge(dep: DependencyDB & { source_name?: string | null; source_ip?: string | null; target_name?: string | null; target_ip?: string | null }): TopologyEdge {
    return {
      id: dep.id,
      source: dep.source_server_id,
      target: dep.target_server_id,
      type: dep.dependency_type,
      dependency_type: dep.dependency_type,
      protocol: dep.protocol || undefined,
      port: dep.port || undefined,
      status: dep.status,
    };
  }

  private edgeToTopologyEdge(dep: DependencyDB): TopologyEdge {
    return {
      id: dep.id,
      source: dep.source_server_id,
      target: dep.target_server_id,
      type: dep.dependency_type,
      dependency_type: dep.dependency_type,
      protocol: dep.protocol || undefined,
      port: dep.port || undefined,
      status: dep.status,
    };
  }

  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const topologyService = new TopologyService();
