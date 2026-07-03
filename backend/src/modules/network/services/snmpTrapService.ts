import snmp from 'net-snmp';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { snmpTrapEventsRepo, networkDeviceRepository, alertRepository } from '../../../repositories';

// ================================================================
// SNMP Trap 接收器
//
// 监听设备主动上报的 Trap：
//   - 接口状态变更 (linkUp/linkDown)
//   - 设备重启 (coldStart/warmStart)
//   - 厂商自定义 Trap
//
// 可直接注入告警系统
// ================================================================

export interface TrapEvent {
  id: string;
  source_ip: string;
  trap_type: string;
  enterprise_oid?: string;
  agent_address?: string;
  generic_type: number;
  specific_type: number;
  timestamp: string;
  varbinds: Array<{ oid: string; value: any }>;
}

class SnmpTrapService {
  private receivers: Map<string, snmp.Receiver> = new Map();
  private running = false;

  /**
   * 启动 Trap 监听（默认 UDP 162 端口）
   */
  start(port = 162, address = '0.0.0.0'): void {
    if (this.running) {
      logger.warn('SNMP Trap receiver is already running');
      return;
    }

    try {
      const receiver = snmp.createReceiver(address, port, (error: any, data?: any) => {
        if (error) {
          logger.error(`SNMP Trap receive error: ${error.message}`);
          return;
        }

        if (!data) return;

        this.processTrap(data);
      });

      const key = `${address}:${port}`;
      this.receivers.set(key, receiver);
      this.running = true;

      logger.info(`SNMP Trap receiver listening on ${address}:${port}`);
    } catch (error: unknown) {
      logger.error(`Failed to start SNMP Trap receiver: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 停止 Trap 监听
   */
  stop(): void {
    for (const [key, receiver] of this.receivers) {
      try {
        receiver.close();
      } catch { /* ignore */ }
      logger.info(`SNMP Trap receiver stopped: ${key}`);
    }
    this.receivers.clear();
    this.running = false;
  }

  /**
   * 处理收到的 Trap
   */
  private processTrap(pdu: any): void {
    try {
      const event: TrapEvent = {
        id: randomUUID(),
        source_ip: pdu.sourceAddress || pdu.agentAddress || 'unknown',
        trap_type: TrapGenericType[pdu.genericType] || 'unknown',
        enterprise_oid: pdu.enterprise || '',
        agent_address: pdu.agentAddress || '',
        generic_type: pdu.genericType ?? 0,
        specific_type: pdu.specificType ?? 0,
        timestamp: new Date().toISOString(),
        varbinds: [],
      };

      // 提取 varbind
      if (pdu.varbinds && Array.isArray(pdu.varbinds)) {
        for (const v of pdu.varbinds) {
          event.varbinds.push({
            oid: v.oid,
            value: v.value,
          });
        }
      }

      // 保存到数据库
      this.saveTrapEvent(event);

      // 注入告警系统
      this.injectAlert(event);

      logger.debug(`SNMP Trap received: type=${event.trap_type} from=${event.source_ip}`);
    } catch (error: unknown) {
      logger.error(`Failed to process SNMP trap: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 保存 Trap 事件到数据库
   */
  private saveTrapEvent(event: TrapEvent): void {
    try {
      snmpTrapEventsRepo.insert({
        id: event.id,
        source_ip: event.source_ip,
        trap_type: event.trap_type,
        enterprise_oid: event.enterprise_oid || '',
        agent_address: event.agent_address || '',
        generic_type: event.generic_type,
        specific_type: event.specific_type,
        varbinds_json: JSON.stringify(event.varbinds),
      });
    } catch (error: unknown) {
      logger.error(`Failed to save trap event: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 将 Trap 转换为告警并注入
   */
  private injectAlert(event: TrapEvent): void {
    try {
      // 尝试匹配 trap 来源设备
      let deviceName = event.agent_address || event.source_ip;
      const device = networkDeviceRepository.getByIp(event.source_ip);
      if (device) deviceName = device.name;

      // Trap 类型 → 告警映射
      const trapAlerts: Record<string, { severity: string; title: string; content: string }> = {
        coldStart: {
          severity: 'critical',
          title: `[SNMP Trap] 设备重启：${deviceName}`,
          content: `设备 ${deviceName} (${event.source_ip}) 发送了 coldStart Trap，设备可能已重启。`,
        },
        warmStart: {
          severity: 'warning',
          title: `[SNMP Trap] 设备热重启：${deviceName}`,
          content: `设备 ${deviceName} (${event.source_ip}) 发送了 warmStart Trap，设备已重新加载配置。`,
        },
        linkDown: {
          severity: 'warning',
          title: `[SNMP Trap] 接口 Down：${deviceName}`,
          content: this.buildLinkTrapContent(event, deviceName, 'Down'),
        },
        linkUp: {
          severity: 'info',
          title: `[SNMP Trap] 接口 Up：${deviceName}`,
          content: this.buildLinkTrapContent(event, deviceName, 'Up'),
        },
        authenticationFailure: {
          severity: 'high',
          title: `[SNMP Trap] 认证失败：${deviceName}`,
          content: `设备 ${deviceName} (${event.source_ip}) 报告 SNMP 认证失败，可能有非法访问尝试。`,
        },
        egpNeighborLoss: {
          severity: 'critical',
          title: `[SNMP Trap] 路由邻居丢失：${deviceName}`,
          content: `设备 ${deviceName} (${event.source_ip}) 报告 EGP 邻居丢失。`,
        },
      };

      const alertDef = trapAlerts[event.trap_type];
      if (alertDef) {
        const alertId = randomUUID();
        alertRepository.create({
          id: alertId,
          source: 'snmp_trap',
          severity: alertDef.severity,
          title: alertDef.title,
          content: alertDef.content,
          metadata: {
            source_ip: event.source_ip,
            generic_type: event.generic_type,
            specific_type: event.specific_type,
            varbinds: event.varbinds,
            device_name: deviceName,
            device_id: device?.id,
          },
        });

        logger.info(`SNMP Trap → Alert: ${alertDef.title}`);
      }
    } catch (error: unknown) {
      logger.error(`Failed to inject alert from trap: ${getErrorMessage(error)}`);
    }
  }

  private buildLinkTrapContent(event: TrapEvent, deviceName: string, status: string): string {
    const ifIndex = event.varbinds.find(v => v.oid.includes('1.3.6.1.2.1.2.2.1.1'))?.value;
    const ifName = event.varbinds.find(v => v.oid.includes('1.3.6.1.2.1.2.2.1.2') || v.oid.includes('1.3.6.1.2.1.31.1.1.1.1'))?.value;

    return `设备 ${deviceName} (${event.source_ip}) 接口 ${ifName || `#${ifIndex}`} 状态变为 ${status}。`;
  }

  /**
   * 获取 Trap 历史
   */
  getTrapHistory(limit = 50, sourceIp?: string): TrapEvent[] {
    const rows = snmpTrapEventsRepo.list(limit, sourceIp) as any[];
    return rows.map(r => ({
      id: r.id,
      source_ip: r.source_ip,
      trap_type: r.trap_type,
      enterprise_oid: r.enterprise_oid,
      agent_address: r.agent_address,
      generic_type: r.generic_type,
      specific_type: r.specific_type,
      timestamp: r.created_at,
      varbinds: JSON.parse(r.varbinds_json || '[]'),
    }));
  }
}

const TrapGenericType: Record<number, string> = {
  0: 'coldStart',
  1: 'warmStart',
  2: 'linkDown',
  3: 'linkUp',
  4: 'authenticationFailure',
  5: 'egpNeighborLoss',
  6: 'enterpriseSpecific',
};

export const snmpTrapService = new SnmpTrapService();
