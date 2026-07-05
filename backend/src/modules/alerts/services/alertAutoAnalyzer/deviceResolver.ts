/**
 * 设备解析：根据告警定位关联设备，获取诊断命令与 SNMP 巡检数据
 */

import { alertRepository, networkDeviceRepository, serversRepo, snmpRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { decrypt } from '../../../auth/services/encryptionService';
import { getErrorMessage } from '../../../../utils/errorHelpers';

// ====================== 类型定义 ======================

export interface DeviceInfo {
  id: string;
  name: string;
  ip_address: string;
  username?: string;
  password?: string;
  ssh_port?: number;
  enable_password?: string;
  device_type: 'network_device' | 'server';
  /** 诊断方式: ssh=SSH 登录, snmp=取 SNMP 巡检数据 */
  auth_method: 'ssh' | 'snmp';
}

// ====================== 诊断命令常量 ======================

/** 网络设备诊断命令（按厂商分组） */
const DIAG_CMDS: Record<string, string[]> = {
  huawei: [
    'display version',
    'display device',
    'display interface brief',
    'display logbuffer level error | tail 20',
    'display cpu-usage',
    'display memory-usage',
    'display alarm active',
    'display elabel brief 2>/dev/null || display device manicinfo 2>/dev/null || echo "no elabel cmd"',
  ],
  cisco: [
    'show version',
    'show inventory',
    'show ip interface brief',
    'show logging | tail -20',
    'show processes cpu sorted | head -10',
    'show process memory sorted | head -10',
    'show environment all',
  ],
  h3c: [
    'display version',
    'display device',
    'display interface brief',
    'display logbuffer level error | tail 20',
    'display cpu-usage',
    'display memory-usage',
  ],
  ruijie: [
    'show version',
    'show interface brief',
    'show logging last 20',
    'show cpu',
    'show memory',
  ],
  zte: [
    'show version',
    'show interface brief',
    'show logging',
    'show cpu',
  ],
};

const DEFAULT_NETWORK_CMDS = [
  'show version 2>/dev/null || display version 2>/dev/null || echo "version cmd not found"',
  'show interface brief 2>/dev/null || display interface brief 2>/dev/null || echo "no interface cmd"',
  'show logging last 20 2>/dev/null || display logbuffer level error | tail 20 2>/dev/null || echo "no log cmd"',
  'uptime',
  'dmesg | tail -20 2>/dev/null || echo "no dmesg"',
];

/** 服务器诊断命令 */
const SERVER_CMDS = [
  'hostnamectl',
  'uptime',
  'top -bn1 | head -20',
  'free -m',
  'df -h | grep -v tmpfs | grep -v overlay',
  'dmesg -T | tail -30',
  'journalctl -n 20 --no-pager 2>/dev/null || tail -20 /var/log/syslog 2>/dev/null || echo "no journal"',
  'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null | head -20',
  'systemctl list-units --failed --no-pager 2>/dev/null || echo "no systemctl"',
  'cat /proc/loadavg',
];

// ====================== 工具函数 ======================

export function safeJsonParse(str: string | null | undefined, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return fallback;
  }
}

// ====================== 设备解析 ======================

/** 根据告警查找关联设备（优先 network_devices，再查 servers） */
export function findDeviceByAlert(alertId: string): DeviceInfo | null {
  // 1. 查 alert_device_associations
  const assoc = alertRepository.deviceAssociations.getByAlertId(alertId);

  if (assoc) {
    if (assoc.device_type === 'network_device') {
      const nd = networkDeviceRepository.getAlertAnalysisCredentials(assoc.device_id);
      if (nd?.username) {
        return {
          id: nd.id, name: nd.name, ip_address: nd.ip_address,
          username: nd.username,
          password: nd.password ? decrypt(nd.password) : undefined,
          ssh_port: nd.ssh_port || 22,
          enable_password: nd.enable_password ? decrypt(nd.enable_password) : undefined,
          device_type: 'network_device',
          auth_method: 'ssh',
        };
      }
    } else {
      // server
      const sv = serversRepo.getById(assoc.device_id);
      if (sv?.username) {
        return {
          id: sv.id, name: sv.name, ip_address: sv.hostname,
          username: sv.username,
          password: sv.password ? decrypt(sv.password) : undefined,
          ssh_port: sv.port || 22,
          device_type: 'server',
          auth_method: 'ssh',
        };
      }
    }
  }

  // 2. 回退：直接从 alert 的 metadata/host 字段提取 IP
  const alert = alertRepository.getEssentialById(alertId);
  if (!alert) return null;

  const metadata = safeJsonParse(alert.metadata, {});
  const possibleIps: string[] = [];

  // 从 metadata.host / annotations / labels 中找 IP
  if (metadata.host) possibleIps.push(metadata.host as string);
  const labels = metadata.labels as Record<string, unknown> | undefined;
  if (labels?.instance) possibleIps.push(labels.instance as string);
  const annotations = metadata.annotations as Record<string, unknown> | undefined;
  if (annotations?.instance) possibleIps.push(annotations.instance as string);

  // 从标题和内容中正则匹配 IP
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const titleIps = alert.title.match(ipRegex) || [];
  const contentIps = alert.content?.match(ipRegex) || [];
  possibleIps.push(...titleIps, ...contentIps);

  for (const ip of [...new Set(possibleIps)]) {
    // 查 network_devices（有 SSH 凭证的）
    const nd = networkDeviceRepository.getAlertAnalysisCredentialsByIp(ip);
    if (nd?.username) {
      return {
        id: nd.id, name: nd.name, ip_address: nd.ip_address,
        username: nd.username,
        password: nd.password ? decrypt(nd.password) : undefined,
        ssh_port: nd.ssh_port || 22,
        enable_password: nd.enable_password ? decrypt(nd.enable_password) : undefined,
        device_type: 'network_device',
        auth_method: 'ssh',
      };
    }
    // 查 servers（匹配 hostname、ip_address、private_ip 三个字段）
    const sv = serversRepo.getByIp(ip);
    if (sv?.username) {
      return {
        id: sv.id, name: sv.name, ip_address: sv.hostname,
        username: sv.username,
        password: sv.password ? decrypt(sv.password) : undefined,
        ssh_port: sv.port || 22,
        device_type: 'server',
        auth_method: 'ssh',
      };
    }

    // 3. 回退到 SNMP：该 IP 没有 SSH 凭证但可能有 SNMP 监控
    const snmpDev = networkDeviceRepository.getByIpSnmpOnly(ip);
    if (snmpDev) {
      return {
        id: snmpDev.id, name: snmpDev.name, ip_address: snmpDev.ip_address,
        device_type: 'network_device',
        auth_method: 'snmp',
      };
    }
  }

  return null;
}

/** 获取诊断命令列表 */
export function getDiagnosticCmds(deviceType: 'network_device' | 'server', vendor?: string): string[] {
  if (deviceType === 'server') return SERVER_CMDS;
  if (vendor && DIAG_CMDS[vendor]) return DIAG_CMDS[vendor];
  return DEFAULT_NETWORK_CMDS;
}

/** 根据告警标题生成专有诊断命令 */
export function getAlertSpecificCmds(title: string, deviceType: 'network_device' | 'server'): string[] {
  const lower = title.toLowerCase();
  const cmds: string[] = [];

  if (deviceType === 'server') {
    if (lower.includes('cpu') || lower.includes('load') || lower.includes('high')) {
      cmds.push('ps aux --sort=-%cpu | head -10');
      cmds.push('top -bn1 -o %CPU | head -15');
      cmds.push('vmstat 1 3');
    }
    if (lower.includes('memory') || lower.includes('mem') || lower.includes('oom') || lower.includes('swap')) {
      cmds.push('ps aux --sort=-%mem | head -10');
      cmds.push('cat /proc/meminfo');
      cmds.push('vmstat -s 2>/dev/null | head -10');
    }
    if (lower.includes('disk') || lower.includes('storage') || lower.includes('io') || lower.includes('space')) {
      cmds.push('df -h');
      cmds.push('iostat -x 1 3 2>/dev/null || echo "no iostat"');
      cmds.push('du -sh /var/log/* 2>/dev/null | sort -rh | head -10');
    }
    if (lower.includes('process') || lower.includes('service') || lower.includes('daemon') || lower.includes('crash')) {
      cmds.push('systemctl list-units --failed --no-pager');
      cmds.push('journalctl -p err -n 30 --no-pager 2>/dev/null || tail -30 /var/log/syslog 2>/dev/null');
    }
    if (lower.includes('network') || lower.includes('connect') || lower.includes('timeout')) {
      cmds.push('ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null');
      cmds.push('ip addr show 2>/dev/null || ifconfig -a 2>/dev/null');
    }
  } else {
    if (lower.includes('cpu') || lower.includes('high')) {
      cmds.push(
        'show processes cpu sorted 2>/dev/null | head -15 || display cpu-usage 2>/dev/null || top -bn1 | head -20'
      );
    }
    if (lower.includes('memory') || lower.includes('mem')) {
      cmds.push(
        'show process memory sorted | head -15 2>/dev/null || display memory-usage 2>/dev/null || free -m'
      );
    }
    if (lower.includes('interface') || lower.includes('port') || lower.includes('link') || lower.includes('down')) {
      cmds.push(
        'show interface description 2>/dev/null | grep -i "down" | head -20 || display interface brief | grep -i down 2>/dev/null | head -20'
      );
    }
    if (lower.includes('temperature') || lower.includes('temp') || lower.includes('fan') || lower.includes('power')) {
      cmds.push(
        'show environment all 2>/dev/null || display environment 2>/dev/null || sensors 2>/dev/null | head -30'
      );
    }
    if (lower.includes('bgp') || lower.includes('ospf') || lower.includes('route')) {
      cmds.push(
        'show ip route summary 2>/dev/null || display ip routing-table summary 2>/dev/null || ip route | head -20'
      );
    }
  }

  return cmds;
}

/** 获取 SNMP 巡检数据作为分析输入 */
export function getSnmpInspectionData(deviceId: string, deviceName: string, deviceIp: string): {
  rawOutput: string;
  commands: string[];
} {
  try {
    // 取最近 3 条 SNMP 巡检记录
    const records = snmpRepository.inspection.listRecentByDeviceId(deviceId, 3);

    if (records.length === 0) {
      // 没有巡检记录，尝试从 snmp_interface_metrics 获取接口指标
      const metrics = snmpRepository.inspection.listRecentInterfaceMetrics(deviceId, 10);

      if (metrics.length === 0) {
        return {
          rawOutput: '【SNMP】设备 ' + deviceName + '(' + deviceIp + ') 未找到 SNMP 巡检记录和接口指标数据',
          commands: ['snmp:check_inspection_history', 'snmp:check_interface_metrics'],
        };
      }

      let output = '【SNMP 接口指标 - ' + deviceName + '(' + deviceIp + ')】\n';
      for (const m of metrics.slice(0, 5)) {
        const operStatus = m.if_oper_status === 1 ? 'UP' : 'DOWN';
        const adminStatus = m.if_admin_status === 1 ? 'UP' : 'DOWN';
        output += '接口 ' + m.interface_name + ' (索引 ' + m.if_index + '): ';
        output += '管理状态=' + adminStatus + ', 运行状态=' + operStatus;
        output += ', 速度=' + (m.if_speed || '未知');
        output += ', 入流量=' + (m.if_in_octets || 0) + ', 出流量=' + (m.if_out_octets || 0);
        output += ', 入错误=' + (m.if_in_errors || 0) + ', 出错误=' + (m.if_out_errors || 0);
        output += '\n';
      }

      return { rawOutput: output, commands: ['snmp:get_interface_metrics'] };
    }

    // 有巡检记录，拼接成分析输入
    let output = '【SNMP 巡检记录 - ' + deviceName + '(' + deviceIp + ')】\n';
    const cmds: string[] = [];
    for (const r of records) {
      output += '\n巡检类型: ' + r.inspection_type + '\n';
      output += '状态: ' + r.status + '\n';
      output += '时间: ' + r.created_at + '\n';
      if (r.summary) output += '摘要: ' + r.summary + '\n';
      if (r.results) {
        try {
          const parsed = typeof r.results === 'string' ? JSON.parse(r.results) : r.results;
          output += '结果: ' + JSON.stringify(parsed, null, 2).slice(0, 2000) + '\n';
        } catch {
          output += '结果: ' + String(r.results).slice(0, 1000) + '\n';
        }
      }
      cmds.push('snmp:inspection_' + r.inspection_type);
    }

    return { rawOutput: output, commands: cmds };
  } catch (err: unknown) {
    logger.warn('获取 SNMP 巡检数据失败 (device=' + deviceId + '): ' + getErrorMessage(err));
    return {
      rawOutput: '【SNMP】获取设备 ' + deviceName + '(' + deviceIp + ') 巡检数据失败: ' + getErrorMessage(err),
      commands: ['snmp:error'],
    };
  }
}
