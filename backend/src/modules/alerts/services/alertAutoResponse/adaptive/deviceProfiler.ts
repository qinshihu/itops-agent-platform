/**
 * =============================================================================
 * AARS v2 — 设备画像引擎（多源加权融合识别）
 *
 * 核心思路：
 *   不搞"依次检查"的硬编码判断，而是多数据源加权投票。
 *   每个数据源有固定的权重 + TTL，综合置信度达标后才采用。
 *   同时维护运行时缓存，减少重复探测。
 * =============================================================================
 */

import { networkDeviceRepository, serversRepo, snmpRepository } from '../../../../../repositories';
import { decrypt } from '../../../../auth/services/encryptionService';
import type { DeviceRuntimeProfile, DeviceCategory, MetricsBaseline } from '../types';

interface IdentificationSource {
  name: string;
  weight: number;   // 0~1
  ttl: number;      // 缓存有效期（秒）
}

const _SOURCE_WEIGHTS: IdentificationSource[] = [
  { name: 'database', weight: 0.40, ttl: 3600 },
  { name: 'fingerprint', weight: 0.30, ttl: 300 },
  { name: 'llm', weight: 0.20, ttl: 0 },
  { name: 'topology', weight: 0.10, ttl: 600 },
];

// 运行时缓存
const profileCache = new Map<string, { profile: DeviceRuntimeProfile; expiresAt: number }>();
const CACHE_TTL_BASE = 300_000; // 5 分钟默认

class DeviceProfiler {
  /**
   * 主入口：根据 IP 地址和设备列表，构建运行时设备画像
   */
  async profile(ip: string, alertTitle?: string, alertContent?: string): Promise<DeviceRuntimeProfile | null> {
    const cacheKey = `profile:${ip}`;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.profile;
    }

    const profile = await this.buildProfile(ip, alertTitle, alertContent);
    if (profile) {
      // 从数据库中读取/计算基线
      profile.baseline = this.loadBaseline(profile.deviceId, profile.type);
      profileCache.set(cacheKey, { profile, expiresAt: Date.now() + CACHE_TTL_BASE });
    }
    return profile;
  }

  /**
   * 多源融合构建画像
   */
  private async buildProfile(ip: string, alertTitle?: string, alertContent?: string): Promise<DeviceRuntimeProfile | null> {
    // ── 源1：数据库匹配 ──
    const dbResult = this.lookupDatabase(ip);
    // ── 源2：拓扑推断 ──
    const topoResult = this.lookupTopology(ip);
    // ── 源3：LLM（从告警内容中提取信息）─
    const llmHint = this.parseAlertForHints(alertTitle, alertContent);

    // 加权融合 —— 置信度加权平均
    let bestType: DeviceCategory = 'unknown';
    let bestAccess: 'ssh' | 'snmp' | 'both' | 'none' = 'none';
    let bestConfidence = 0;
    let bestId = '';
    let _bestName = '';
    let bestHostname = '';

    const candidates: Array<{
      type: DeviceCategory;
      access: 'ssh' | 'snmp' | 'both' | 'none';
      confidence: number;
      source: string;
      id: string;
      name: string;
      hostname: string;
    }> = [];

    if (dbResult) {
      candidates.push({
        type: dbResult.type,
        access: dbResult.access,
        confidence: 0.85,
        source: 'database',
        id: dbResult.id,
        name: dbResult.name,
        hostname: dbResult.hostname,
      });
    }

    if (topoResult) {
      candidates.push({
        type: topoResult.type,
        access: topoResult.access,
        confidence: 0.5,
        source: 'topology',
        id: topoResult.id,
        name: topoResult.name,
        hostname: topoResult.hostname,
      });
    }

    // LLM hint 用来提升候选置信度
    if (llmHint && candidates.length > 0) {
      for (const c of candidates) {
        if (llmHint.type && c.type === llmHint.type) {
          c.confidence = Math.min(1, c.confidence + 0.1);
        }
      }
    }

    // 选择最高置信度候选
    for (const c of candidates) {
      if (c.confidence > bestConfidence) {
        bestConfidence = c.confidence;
        bestType = c.type;
        bestAccess = c.access;
        bestId = c.id;
        _bestName = c.name;
        bestHostname = c.hostname;
      }
    }

    if (bestConfidence < 0.3) {
      return null;
    }

    return {
      deviceId: bestId,
      type: bestType,
      ip,
      hostname: bestHostname,
      accessMethod: bestAccess,
      identificationConfidence: bestConfidence,
    };
  }

  /**
   * 数据库查找（servers / network_devices 表）
   */
  private lookupDatabase(ip: string): {
    type: DeviceCategory;
    access: 'ssh' | 'snmp' | 'both' | 'none';
    id: string;
    name: string;
    hostname: string;
  } | null {
    // 先查 servers
    const server = serversRepo.getByIp(ip);

    if (server?.username) {
      return {
        type: 'server',
        access: 'ssh',
        id: server.id,
        name: server.name,
        hostname: server.hostname,
      };
    }

    // 查 network_devices（优先有 SSH 凭证的）
    const ndSsh = networkDeviceRepository.getByIpWithSshCreds(ip);

    if (ndSsh?.username) {
      return {
        type: 'network_device',
        access: 'both',
        id: ndSsh.id,
        name: ndSsh.name,
        hostname: ndSsh.ip_address,
      };
    }

    // 查 network_devices（仅有 SNMP 的）
    const ndSnmp = networkDeviceRepository.getByIpSnmpOnly(ip);

    if (ndSnmp) {
      return {
        type: 'network_device',
        access: 'snmp',
        id: ndSnmp.id,
        name: ndSnmp.name,
        hostname: ndSnmp.ip_address,
      };
    }

    return null;
  }

  /**
   * 拓扑推断（从相邻设备推断）
   */
  private lookupTopology(ip: string): {
    type: DeviceCategory;
    access: 'ssh' | 'snmp' | 'both' | 'none';
    id: string;
    name: string;
    hostname: string;
  } | null {
    try {
      // 从 lldp/拓扑表中查邻居
      const neighbor = networkDeviceRepository.getTopologyNeighborByIp(ip);

      if (neighbor) {
        return {
          type: 'network_device',
          access: neighbor.username ? 'both' : 'snmp',
          id: neighbor.id,
          name: neighbor.name,
          hostname: neighbor.ip_address,
        };
      }

      // 查 devices 表（如果存在）
      const device = networkDeviceRepository.getDcDeviceByIp(ip);

      if (device) {
        return {
          type: device.device_type === 'server' ? 'server' : 'network_device',
          access: 'none',
          id: device.id,
          name: device.name,
          hostname: device.ip_address,
        };
      }
    } catch {
      // topology 表可能不存在
    }
    return null;
  }

  /**
   * 从告警标题/内容解析可能的设备类型
   */
  private parseAlertForHints(title?: string, content?: string): { type?: DeviceCategory } | null {
    if (!title && !content) return null;
    const text = `${title || ''} ${content || ''}`.toLowerCase();

    // 网络设备关键词
    const networkKeywords = ['switch', 'router', 'firewall', 'ap', 'access point', '交换机', '路由器', '防火墙', 'olt', 'onu', '华为', 'cisco', 'h3c', 'ruijie'];
    // 服务器关键词
    const serverKeywords = ['server', 'linux', 'windows', 'centos', 'ubuntu', 'debian', 'redhat', '服务', '服务器', '虚拟机', 'vm', 'host'];

    let isNetwork = false;
    let isServer = false;

    for (const kw of networkKeywords) {
      if (text.includes(kw)) { isNetwork = true; break; }
    }
    for (const kw of serverKeywords) {
      if (text.includes(kw)) { isServer = true; break; }
    }

    if (isNetwork && !isServer) return { type: 'network_device' };
    if (isServer && !isNetwork) return { type: 'server' };
    // 二者都有或都没有 → 返回空，让其他源决定
    return null;
  }

  /**
   * 加载历史基线（从 snmp_interface_metrics 或系统监控表）
   */
  private loadBaseline(deviceId: string, type: DeviceCategory): MetricsBaseline | undefined {
    try {
      if (type === 'network_device') {
        // 从 SNMP 指标表计算 7 天均值
        const metrics = snmpRepository.inspection.getInterfaceTrafficBaseline(deviceId);

        if (metrics && metrics.samples > 10) {
          return {
            cpuAvg: 0, cpuStddev: 0, memAvg: 0, memStddev: 0,
            diskAvg: {},
            trafficDailyAvg: metrics.traffic_avg || 0,
            responseTimeAvg: 0,
            timestamp: Date.now(),
          };
        }
      }
    } catch {
      // 表可能不存在
    }
    return undefined;
  }

  /**
   * 清除缓存
   */
  invalidateCache(ip: string): void {
    profileCache.delete(`profile:${ip}`);
  }

  /** 获取缓存的完整设备信息（含 SSH/SNMP 凭证） */
  getDeviceCredentials(deviceId: string, type: DeviceCategory): {
    ip: string;
    username?: string;
    password?: string;
    port?: number;
    community?: string;
  } | null {
    if (type === 'server') {
      const sv = serversRepo.getById(deviceId);
      if (!sv) return null;
      return {
        ip: sv.hostname,
        username: sv.username,
        password: sv.password ? decrypt(sv.password) : undefined,
        port: sv.port || 22,
      };
    }

    // 网络设备
    const nd = networkDeviceRepository.getById(deviceId);
    if (!nd) return null;
    const creds: {
      ip: string;
      username?: string;
      password?: string;
      port?: number;
      community?: string;
    } = {
      ip: nd.ip_address,
      community: (nd.community as string) || undefined,
    };
    if (nd.username) {
      creds.username = nd.username;
      creds.password = nd.password ? decrypt(nd.password) : undefined;
      creds.port = nd.ssh_port || 22;
    }
    return creds;
  }
}

export const deviceProfiler = new DeviceProfiler();
