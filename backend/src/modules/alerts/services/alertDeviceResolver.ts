import { logger } from '../../../utils/logger';
import { serversRepo, networkDeviceRepository, deviceAssociationsRepo } from '../../../repositories';

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
  resolve(alertId: string, title: string, content: string, hostname?: string, _source?: string): AlertDeviceAssociation | null {
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
    deviceAssociationsRepo.save({
      alert_id: alertId,
      device_type: deviceType,
      device_id: deviceId,
      match_method: matchMethod,
      confidence,
    });

    logger.debug(`Alert ${alertId} associated with ${deviceType}:${deviceId} (${matchMethod}, ${confidence}%)`);
  }

  /**
   * 获取告警关联的设备信息
   */
  getDeviceForAlert(alertId: string): { device_type: string; device_id: string; device_name: string } | null {
    const assoc = deviceAssociationsRepo.getByAlertId(alertId);

    if (!assoc) return null;

    if (assoc.device_type === 'server') {
      const server = serversRepo.getIdHostnameById(assoc.device_id);
      if (server) return { ...assoc, device_name: server.hostname };
    } else {
      const device = networkDeviceRepository.getByIdNameOnly(assoc.device_id);
      if (device) return { ...assoc, device_name: device.name };
    }

    return null;
  }

  // ── 私有匹配方法 ──

  private matchByHostname(hostname: string): AlertDeviceAssociation | null {
    if (!hostname || hostname.trim() === '') return null;
    const hn = hostname.trim();

    // 1. 精确匹配服务器 hostname
    const server = serversRepo.findIdHostnameByHostname(hn, `%-${hn}%`, `${hn}-%`);
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
    const device = networkDeviceRepository.getByNameOrIp(hn, hn);
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
    const serverFuzzy = serversRepo.findIdHostnameByHostnameFuzzy(`%${hn}%`, hn);
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
      const server = serversRepo.findIdHostnameByIpOrHostname(ip, `%${ip}%`);
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
      const device = networkDeviceRepository.getByIp(ip);
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
      const server = serversRepo.findIdHostnameByHostnameLike(`%${kw}%`);
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
      const device = networkDeviceRepository.findByNameLike(`%${kw}%`);
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
    deviceAssociationsRepo.recordUnmatched(alertId, title, hostname);
  }
}

export const alertDeviceResolver = new AlertDeviceResolver();
