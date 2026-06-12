import { Client } from 'ssh2';
import db from '../models/database';
import { sshPool } from './sshService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { getCommandTemplates, detectOSType, OSType } from './commandDispatcher';

interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key: string | null;
  use_ssh_key: number;
  enabled: number;
}

interface ServerInfoResult {
  success: boolean;
  error?: string;
  data?: {
    os: string;
    cpu_cores: number;
    memory_gb: number;
    disk_gb: number;
    ip_address: string;
    private_ip: string;
  };
}

interface ServerMetricsResult {
  success: boolean;
  error?: string;
  data?: {
    cpu_usage: number;
    memory_usage: number;
    memory_total_gb: number;
    memory_used_gb: number;
    disk_usage: number;
    disk_total_gb: number;
    disk_used_gb: number;
    network_in_mbps: number;
    network_out_mbps: number;
    load_1min: number;
    load_5min: number;
    load_15min: number;
    uptime_seconds: number;
  };
}

class ServerInfoCollector {
  private static readonly CONNECT_TIMEOUT = 10000;

  async collectServerInfo(serverId: string): Promise<ServerInfoResult> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo | undefined;

    if (!server || !server.enabled) {
      return { success: false, error: 'Server not found or disabled' };
    }

    let conn: Client | null = null;

    return new Promise((resolve) => {
      sshPool.acquire(serverId).then((connection) => {
        conn = connection;
      }).catch((error) => {
        resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to acquire SSH connection' });
        return;
      }).then(() => {
        if (!conn) return;

      let isResolved = false;

      const safeResolve = (result: ServerInfoResult) => {
        if (!isResolved) {
          isResolved = true;
          if (conn) {
            sshPool.release(conn, result.success);
          }
          resolve(result);
        }
      };

      // 先检测操作系统类型
      conn!.exec('uname -a 2>/dev/null || powershell -Command "(Get-CimInstance Win32_OperatingSystem).Caption"', (err, stream) => {
        let osDetectOutput = '';
        if (err) {
          osDetectOutput = 'linux';
        } else {
          stream.on('data', (data: Buffer) => {
            osDetectOutput += data.toString('utf-8');
          });
          stream.on('close', () => {
            const detectedOS = detectOSType(osDetectOutput);
            logger.info(`Detected OS for ${server.name}: ${detectedOS}`);

            // 更新服务器的 os_type 字段
            db.prepare('UPDATE servers SET os_type = ? WHERE id = ?').run(detectedOS, serverId);

            // 使用对应系统的模板命令采集信息
            const templates = getCommandTemplates(detectedOS);
            const commands = {
              ...templates.info,
              private_ip: templates.info.ip_address
            };

            const results: Record<string, string> = {};
            let completed = 0;
            const total = Object.keys(commands).length;

            const checkComplete = () => {
              completed++;
              if (completed === total) {
                const osClean = results.os.replace(/\\n/g, '').trim();
                
                const data = {
                  os: osClean || 'Unknown',
                  cpu_cores: parseInt(results.cpu_cores, 10) || 0,
                  memory_gb: parseFloat(results.memory_gb) || 0,
                  disk_gb: parseFloat(results.disk_gb) || 0,
                  ip_address: results.ip_address.trim(),
                  private_ip: results.private_ip.trim()
                };

                db.prepare(`
                  UPDATE servers 
                  SET os = ?, cpu_cores = ?, memory_gb = ?, disk_gb = ?, 
                      ip_address = ?, private_ip = ?, os_type = ?, updated_at = datetime('now','localtime')
                  WHERE id = ?
                `).run(data.os, data.cpu_cores, data.memory_gb, data.disk_gb, data.ip_address, data.private_ip, detectedOS, serverId);

                logger.info(`Server info collected for ${server.name} (${serverId}), OS: ${detectedOS}`);
                safeResolve({ success: true, data });
              }
            };

            for (const [key, cmd] of Object.entries(commands)) {
              conn!.exec(cmd, (err, stream) => {
                if (err) {
                  results[key] = '';
                  checkComplete();
                  return;
                }

                let output = '';
                stream.on('data', (data: Buffer) => {
                  output += data.toString('utf-8');
                });

                stream.on('close', () => {
                  results[key] = output.trim();
                  checkComplete();
                });

                stream.stderr.on('data', () => { /* ignore stderr */ });
              });
            }
          });
          stream.stderr.on('data', () => {
            osDetectOutput = 'linux';
          });
        }
      });
      });
    });
  }

  async collectAllServers(): Promise<{
    success: number;
    failed: number;
    errors: Array<{ serverId: string; serverName: string; error: string }>;
  }> {
    const servers = db.prepare('SELECT id, name FROM servers WHERE enabled = 1').all() as { id: string; name: string }[];
    
    const errors: Array<{ serverId: string; serverName: string; error: string }> = [];
    let success = 0;

    for (const server of servers) {
      const result = await this.collectServerInfo(server.id);
      if (result.success) {
        success++;
      } else {
        errors.push({ serverId: server.id, serverName: server.name, error: result.error || 'Unknown error' });
      }
    }

    return { success, failed: errors.length, errors };
  }

  async collectServerMetrics(serverId: string): Promise<ServerMetricsResult> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo & { os_type?: string } | undefined;

    if (!server || !server.enabled) {
      return { success: false, error: 'Server not found or disabled' };
    }

    let conn: Client | null = null;

    return new Promise((resolve) => {
      sshPool.acquire(serverId).then((connection) => {
        conn = connection;
      }).catch((error) => {
        resolve({ success: false, error: error instanceof Error ? error.message : 'Failed to acquire SSH connection' });
        return;
      }).then(() => {
        if (!conn) return;

        let isResolved = false;

        const safeResolve = (result: ServerMetricsResult) => {
          if (!isResolved) {
            isResolved = true;
            if (conn) {
              sshPool.release(conn, result.success);
            }
            resolve(result);
          }
        };

        // 确定操作系统类型，优先使用数据库中的 os_type，否则使用默认 linux
        const osType = (server.os_type || 'linux') as OSType;
        const templates = getCommandTemplates(osType);
        const commands = templates.metrics;

        const results: Record<string, string> = {};
        let completed = 0;
        const total = Object.keys(commands).length;

        const checkComplete = () => {
          completed++;
          if (completed === total) {
            try {
              const data = this.parseMetricsResults(results);

              db.prepare(`
                INSERT INTO server_metrics (
                  id, server_id, cpu_usage, memory_usage, memory_total_gb, memory_used_gb,
                  disk_usage, disk_total_gb, disk_used_gb, network_in_mbps, network_out_mbps,
                  load_1min, load_5min, load_15min, uptime_seconds, collected_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
              `).run(
                uuidv4(),
                serverId,
                data.cpu_usage,
                data.memory_usage,
                data.memory_total_gb,
                data.memory_used_gb,
                data.disk_usage,
                data.disk_total_gb,
                data.disk_used_gb,
                data.network_in_mbps,
                data.network_out_mbps,
                data.load_1min,
                data.load_5min,
                data.load_15min,
                data.uptime_seconds
              );

              logger.info(`Server metrics collected for ${server.name} (${serverId}): CPU=${data.cpu_usage?.toFixed(1)}%, OS: ${osType}`);
              safeResolve({ success: true, data });
            } catch (error) {
              logger.error(`Failed to save metrics for ${serverId}:`, error);
              safeResolve({ success: false, error: error instanceof Error ? error.message : 'Failed to save metrics' });
            }
          }
        };

        for (const [key, cmd] of Object.entries(commands)) {
          conn!.exec(cmd, (err, stream) => {
            if (err) {
              results[key] = '';
              checkComplete();
              return;
            }

            let output = '';
            stream.on('data', (data: Buffer) => {
              output += data.toString('utf-8');
            });

            stream.on('close', () => {
              results[key] = output.trim();
              checkComplete();
            });

            stream.stderr.on('data', () => { /* ignore stderr */ });
          });
        }
      });
    });
  }

  private parseMetricsResults(results: Record<string, string>): NonNullable<ServerMetricsResult['data']> {
    let cpu_usage = 0;
    try {
      const cpuStr = results.cpu_usage.trim();
      if (cpuStr) {
        cpu_usage = parseFloat(cpuStr);
        if (isNaN(cpu_usage) || cpu_usage < 0 || cpu_usage > 100) {
          cpu_usage = 0;
        }
      }
    } catch {
      cpu_usage = 0;
    }

    let memory_usage = 0, memory_total_gb = 0, memory_used_gb = 0;
    try {
      const memParts = results.memory.trim().split(/\s+/);
      if (memParts.length >= 3) {
        memory_total_gb = parseFloat(memParts[0]);
        memory_used_gb = parseFloat(memParts[1]);
        memory_usage = parseFloat(memParts[2]);
      }
    } catch {
      // defaults
    }

    let disk_usage = 0, disk_total_gb = 0, disk_used_gb = 0;
    try {
      const diskParts = results.disk.trim().split(/\s+/);
      if (diskParts.length >= 3) {
        const sizeStr = diskParts[0].replace(/[A-Za-z]/g, '');
        const usedStr = diskParts[1].replace(/[A-Za-z]/g, '');
        const pcentStr = diskParts[2].replace('%', '');
        disk_total_gb = parseFloat(sizeStr);
        disk_used_gb = parseFloat(usedStr);
        disk_usage = parseFloat(pcentStr);
      }
    } catch {
      // defaults
    }

    let network_in_mbps = 0, network_out_mbps = 0;
    try {
      const netParts = results.network.trim().split(/\s+/);
      if (netParts.length >= 2) {
        network_in_mbps = parseFloat(netParts[0]);
        network_out_mbps = parseFloat(netParts[1]);
      }
    } catch {
      // defaults
    }

    let load_1min = 0, load_5min = 0, load_15min = 0;
    try {
      const loadParts = results.load.trim().split(/[\s,]+/).filter(s => s);
      if (loadParts.length >= 3) {
        load_1min = parseFloat(loadParts[0]);
        load_5min = parseFloat(loadParts[1]);
        load_15min = parseFloat(loadParts[2]);
      }
    } catch {
      // defaults
    }

    let uptime_seconds = 0;
    try {
      uptime_seconds = parseInt(results.uptime.trim(), 10) || 0;
    } catch {
      // defaults
    }

    return {
      cpu_usage: isNaN(cpu_usage) ? 0 : cpu_usage,
      memory_usage: isNaN(memory_usage) ? 0 : memory_usage,
      memory_total_gb: isNaN(memory_total_gb) ? 0 : memory_total_gb,
      memory_used_gb: isNaN(memory_used_gb) ? 0 : memory_used_gb,
      disk_usage: isNaN(disk_usage) ? 0 : disk_usage,
      disk_total_gb: isNaN(disk_total_gb) ? 0 : disk_total_gb,
      disk_used_gb: isNaN(disk_used_gb) ? 0 : disk_used_gb,
      network_in_mbps: isNaN(network_in_mbps) ? 0 : network_in_mbps,
      network_out_mbps: isNaN(network_out_mbps) ? 0 : network_out_mbps,
      load_1min: isNaN(load_1min) ? 0 : load_1min,
      load_5min: isNaN(load_5min) ? 0 : load_5min,
      load_15min: isNaN(load_15min) ? 0 : load_15min,
      uptime_seconds: uptime_seconds
    };
  }

  async collectAllServerMetrics(): Promise<{
    success: number;
    failed: number;
    errors: Array<{ serverId: string; serverName: string; error: string }>;
  }> {
    const servers = db.prepare('SELECT id, name FROM servers WHERE enabled = 1').all() as { id: string; name: string }[];
    
    const errors: Array<{ serverId: string; serverName: string; error: string }> = [];
    let success = 0;

    for (const server of servers) {
      const result = await this.collectServerMetrics(server.id);
      if (result.success) {
        success++;
      } else {
        errors.push({ serverId: server.id, serverName: server.name, error: result.error || 'Unknown error' });
      }
    }

    logger.info(`Metrics collection completed: ${success} success, ${errors.length} failed`);
    return { success, failed: errors.length, errors };
  }
}

export const serverInfoCollector = new ServerInfoCollector();
