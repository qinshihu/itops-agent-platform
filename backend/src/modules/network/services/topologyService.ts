import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { executeCommand } from '../../servers/services/sshService';
import { serversRepo, topologyRepo } from '../../../repositories/serverRepository';
import { alertRepository } from '../../../repositories';

export interface DependencyInput {
  source_server_id: string;
  target_server_id: string;
  dependency_type: string;
  protocol?: string;
  port?: number;
  metadata?: Record<string, string>;
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
    const server = serversRepo.getById(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    const commands = [
      'netstat -tunapl 2>/dev/null || ss -tunapl 2>/dev/null',
      'lsof -i -P -n 2>/dev/null',
      'cat /etc/hosts 2>/dev/null',
    ];

    const discovered: DependencyInput[] = [];
    const allServers = serversRepo.listSummary();

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

    topologyRepo.insertDependency({
      id,
      source_server_id: input.source_server_id,
      target_server_id: input.target_server_id,
      dependency_type: input.dependency_type,
      protocol: input.protocol || null,
      port: input.port || null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      created_at: now,
      updated_at: now,
    });

    return this.edgeToTopologyEdge(this.getDependencyById(id)!);
  }

  getServerTopology(serverId: string): TopologyGraph {
    const server = serversRepo.getById(serverId);
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

    const deps = topologyRepo.getDependencies(serverId) as unknown as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

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
    const servers = serversRepo.listSummary();
    const deps = topologyRepo.getAllDependencies() as unknown as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

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
    const deps = topologyRepo.getActiveDependencies() as unknown as DependencyDB[];
    const results: Array<{ id: string; source_server_id: string; target_server_id: string; status: string; verified_at: string }> = [];

    for (const dep of deps) {
      let status = 'inactive';
      const now = new Date().toISOString();

      try {
        const target = serversRepo.getById(dep.target_server_id);
        if (target) {
          const result = await executeCommand(dep.source_server_id, `ping -c 1 -W 2 ${target.hostname}`, { logHistory: false });
          status = result.success ? 'active' : 'inactive';
        }
      } catch {
        status = 'unknown';
      }

      topologyRepo.updateDependencyVerification(dep.id, status, now, now);

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
    const alert = alertRepository.getById(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    const deviceAssoc = alertRepository.deviceAssociations.getByAlertId(alertId);
    const serverId = deviceAssoc?.device_type === 'server' ? deviceAssoc.device_id : null;
    if (!serverId) {
      return { upstream: [], downstream: [] };
    }

    const upstream = this.findUpstream(serverId);
    const downstream = this.findDownstream(serverId);

    return { upstream, downstream };
  }

  deleteDependency(id: string): boolean {
    return topologyRepo.deleteDependency(id) > 0;
  }

  getDependenciesByServer(serverId: string): TopologyEdge[] {
    const deps = topologyRepo.getDependencies(serverId) as unknown as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    return deps.map(dep => this.dependencyToEdge(dep));
  }

  getAllDependencies(): TopologyEdge[] {
    const deps = topologyRepo.getAllDependencies() as unknown as (DependencyDB & { source_name: string | null; source_ip: string | null; target_name: string | null; target_ip: string | null })[];

    return deps.map(dep => this.dependencyToEdge(dep));
  }

  private findUpstream(serverId: string, visited: Set<string> = new Set(), distance = 0, path: string[] = [], maxDepth = 10): AffectedService[] {
    if (visited.has(serverId) || distance >= maxDepth) return [];
    visited.add(serverId);

    const server = serversRepo.getById(serverId);
    if (!server) return [];

    const deps = topologyRepo.getUpstreamDependencies(serverId) as unknown as (DependencyDB & { source_name: string | null; source_ip: string | null })[];

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

    const server = serversRepo.getById(serverId);
    if (!server) return [];

    const deps = topologyRepo.getDownstreamDependencies(serverId) as unknown as (DependencyDB & { target_name: string | null; target_ip: string | null })[];

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
    return topologyRepo.getDependencyById(id) as unknown as DependencyDB | undefined;
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
