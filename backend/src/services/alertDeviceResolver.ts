import db from '../models/database';
import { logger } from '../utils/logger';

// ================================================================
// 告警→设备自动关联服务
//
// 功能：
// 1. 根据告警标题/主机名/IP 自动匹配 servers 或 network_devices
// 2. 将设备 ID 写入告警关联表
// 3. 为 RCA 和工作流提供设备上下文
// ================================================================

export interface AlertDeviceAssociation {
  alert_id: string;
  device_type: 'server' | 'network_device';
  device_id: string;
  device_name: string;
  match_method: 'exact_hostname' | 'fuzzy_hostname' | 'ip_address' | 'title_keyword' | 'manual';
  confidence: number; // 0-100
}

class AlertDeviceResolver {

  /**
   * 解析告警关联的设备
   * 返回最匹配的设备，如果没有命中返回 null
   */
  resolve(alertId: string, title: string, content: string, hostname?: string, source?: string): AlertDeviceAssociation | null {
    // 策略 1: 精确主机名匹配（告警中的 hostname）
    if (hostname) {
      const match = this.matchByHostname(hostname);
      if (match) return match;
    }

    // 策略 2: IP 地址匹配（从 content 中提取 IP）
    const ipMatch = this.matchByContentIP(title, content);
    if (ipMatch) return ipMatch;

    // 策略 3: 告警标题模糊匹配
    const titleMatch = this.matchByTitleKeywords(title, hostname);
    if (titleMatch) return titleMatch;

    // 策略 4: 通知已关联但未自动匹配
    logger.debug(`No device matched for alert ${alertId}: "${title}"`);

    // 记录未匹配的告警源信息（辅助后续学习匹配）
    this.recordUnmatchedAlert(alertId, title, hostname);

    return null;
  }

  /**
   * 保存告警-设备关联到数据库
   */
  saveAssociation(alertId: string, deviceType: 'server' | 'network_device', deviceId: string, matchMethod: string, confidence: number): void {
    db.prepare(`
      INSERT OR REPLACE INTO alert_device_associations (alert_id, device_type, device_id, match_method, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(alertId, deviceType, deviceId, matchMethod, confidence);

    logger.debug(`Alert ${alertId} associated with ${deviceType}:${deviceId} (${matchMethod}, ${confidence}%)`);
  }

  /**
   * 获取告警关联的设备信息
   */
  getDeviceForAlert(alertId: string): { device_type: string; device_id: string; device_name: string } | null {
    const assoc = db.prepare(`
      SELECT ad.device_type, ad.device_id, ad.match_method
      FROM alert_device_associations ad
      WHERE ad.alert_id = ?
    `).get(alertId) as any;

    if (!assoc) return null;

    if (assoc.device_type === 'server') {
      const server = db.prepare('SELECT id, hostname as name FROM servers WHERE id = ?')
        .get(assoc.device_id) as any;
      if (server) return { ...assoc, device_name: server.name };
    } else {
      const device = db.prepare('SELECT id, name FROM network_devices WHERE id = ?')
        .get(assoc.device_id) as any;
      if (device) return { ...assoc, device_name: device.name };
    }

    return null;
  }

  // ── 私有匹配方法 ──

  private matchByHostname(hostname: string): AlertDeviceAssociation | null {
    if (!hostname || hostname.trim() === '') return null;
    const hn = hostname.trim();

    // 1. 精确匹配服务器 hostname
    const server = db.prepare(
      "SELECT id, hostname FROM servers WHERE hostname = ? OR hostname LIKE ? OR hostname LIKE ?"
    ).get(hn, `%-${hn}%`, `${hn}-%`) as { id: string; hostname: string } | undefined;
    if (server) {
      return {
        alert_id: '',
        device_type: 'server',
        device_id: server.id,
        device_name: server.hostname,
        match_method: 'exact_hostname',
        confidence: 95,
      };
    }

    // 2. 精确匹配网络设备名
    const device = db.prepare(
      "SELECT id, name FROM network_devices WHERE name = ? OR ip_address = ?"
    ).get(hn, hn) as { id: string; name: string } | undefined;
    if (device) {
      return {
        alert_id: '',
        device_type: 'network_device',
        device_id: device.id,
        device_name: device.name,
        match_method: 'exact_hostname',
        confidence: 90,
      };
    }

    // 3. 模糊匹配（主机名前缀）
    const serverFuzzy = db.prepare(
      "SELECT id, hostname FROM servers WHERE hostname LIKE ? OR ? LIKE CONCAT('%', hostname) LIMIT 1"
    ).get(`%${hn}%`, hn) as { id: string; hostname: string } | undefined;
    if (serverFuzzy) {
      return {
        alert_id: '',
        device_type: 'server',
        device_id: serverFuzzy.id,
        device_name: serverFuzzy.hostname,
        match_method: 'fuzzy_hostname',
        confidence: 70,
      };
    }

    return null;
  }

  private matchByContentIP(title: string, content: string): AlertDeviceAssociation | null {
    const combined = `${title} ${content}`;
    const ipPattern = /\b((?:\d{1,3}\.){3}\d{1,3})\b/g;
    const ips = [...combined.matchAll(ipPattern)]
      .map(m => m[1])
      .filter(ip => {
        const parts = ip.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255) &&
               !ip.startsWith('127.') && !ip.startsWith('169.254.');
      });

    if (ips.length === 0) return null;

    for (const ip of ips) {
      // 检查是否是服务器 IP
      const server = db.prepare(
        "SELECT id, hostname FROM servers WHERE ip_address = ? OR hostname LIKE ?"
      ).get(ip, `%${ip}%`) as { id: string; hostname: string } | undefined;
      if (server) {
        return {
          alert_id: '',
          device_type: 'server',
          device_id: server.id,
          device_name: server.hostname,
          match_method: 'ip_address',
          confidence: 80,
        };
      }

      // 检查是否是网络设备 IP
      const device = db.prepare(
        "SELECT id, name FROM network_devices WHERE ip_address = ?"
      ).get(ip) as { id: string; name: string } | undefined;
      if (device) {
        return {
          alert_id: '',
          device_type: 'network_device',
          device_id: device.id,
          device_name: device.name,
          match_method: 'ip_address',
          confidence: 85,
        };
      }
    }

    return null;
  }

  private matchByTitleKeywords(title: string, hostname?: string): AlertDeviceAssociation | null {
    // 从标题或 content 中提取可能的设备关键词
    const keywords = [
      ...(title || '').split(/[\s\-_,.:/]+/).filter(k => k.length > 2),
      ...(hostname?.split('-') || []).filter(k => k.length > 2),
    ];

    for (const kw of [...new Set(keywords)]) {
      // 服务器匹配
      const server = db.prepare(
        "SELECT id, hostname FROM servers WHERE hostname LIKE ? LIMIT 1"
      ).get(`%${kw}%`) as { id: string; hostname: string } | undefined;
      if (server) {
        return {
          alert_id: '',
          device_type: 'server',
          device_id: server.id,
          device_name: server.hostname,
          match_method: 'title_keyword',
          confidence: 60,
        };
      }

      // 网络设备匹配
      const device = db.prepare(
        "SELECT id, name FROM network_devices WHERE name LIKE ? LIMIT 1"
      ).get(`%${kw}%`) as { id: string; name: string } | undefined;
      if (device) {
        return {
          alert_id: '',
          device_type: 'network_device',
          device_id: device.id,
          device_name: device.name,
          match_method: 'title_keyword',
          confidence: 55,
        };
      }
    }

    return null;
  }

  private recordUnmatchedAlert(alertId: string, title: string, hostname?: string): void {
    db.prepare(`
      INSERT OR IGNORE INTO alert_device_match_log (id, alert_title, alert_hostname, match_method, matched)
      VALUES (?, ?, ?, 'auto', 0)
    `).run(alertId, title?.substring(0, 200) || '', hostname?.substring(0, 100) || '');
  }
}

export const alertDeviceResolver = new AlertDeviceResolver();
