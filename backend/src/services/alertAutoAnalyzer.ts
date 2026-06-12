/**
 * =============================================================================
 * ITOps Agent Platform - 告警自动分析器
 * =============================================================================
 *
 * 工作流：
 *   告警涌入 → 提取 IP → 查找设备 → SSH/SNMP → AI 分析 → 写入结果
 *
 * 支持设备类型：
 *   - network_devices（交换机/路由器/防火墙）—— SSH 或 SNMP 巡检
 *   - servers（Linux 服务器）—— SSH 诊断
 *
 * 诊断方式：
 *   - SSH 路径：有 SSH 凭证 → SSH 登录执行命令 → AI 分析输出
 *   - SNMP 路径：无 SSH 凭证但有 SNMP 监控 → 取最近 SNMP 巡检结果 → AI 分析
 *
 * 依赖服务：
 *   - sshService: SSH 连接执行命令
 *   - llmService: AI 分析输出
 *   - alertDeviceResolver: 告警→设备联动
 * =============================================================================
 */

import { Client } from 'ssh2';
import crypto from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';
import { decrypt } from './encryptionService';
import { generateCompletion } from './llmService';
import { remediationService } from './remediationService';

// ====================== 类型定义 ======================

export interface AutoAnalysisResult {
  id: string;
  alert_id: string;
  device_id: string;
  device_name: string;
  device_ip: string;
  device_type: 'network_device' | 'server';
  status: 'pending' | 'running' | 'completed' | 'failed';
  diagnosis: string;           // AI 诊断结论
  summary: string;             // 简短摘要
  raw_output: string;          // SSH 原始输出
  commands_executed: string[]; // 执行的命令列表
  error_message?: string;
  duration_ms: number;
  created_at: string;
}

interface DeviceInfo {
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

// 网络设备诊断命令（按厂商分组）
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

// ====================== 服务实现 ======================

class AlertAutoAnalyzer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 15_000;  // 15 秒轮一次
  private readonly MIN_SEVERITY = 'medium';     // 只分析 medium 及以上
  private processingIds = new Set<string>();     // 正在处理的告警 ID，避免重复

  /** 确保分析结果表存在 */
  private ensureTable(): void {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='alert_auto_analysis'"
    ).all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS alert_auto_analysis (
          id TEXT PRIMARY KEY,
          alert_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          device_ip TEXT NOT NULL,
          device_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          diagnosis TEXT,
          summary TEXT,
          raw_output TEXT,
          commands_executed TEXT,
          error_message TEXT,
          duration_ms INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE
        )
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_analysis_alert ON alert_auto_analysis(alert_id)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_auto_analysis_status ON alert_auto_analysis(status)`);
      logger.info('✅ Created alert_auto_analysis table');
    }
  }

  /** 查找未分析的高优告警 */
  private fetchPendingAlerts(): { id: string; title: string; severity: string; source: string }[] {
    const rows = db.prepare(`
      SELECT a.id, a.title, a.severity, a.source
      FROM alerts a
      WHERE a.status = 'new'
        AND a.severity IN ('critical', 'high', 'medium')
        AND NOT EXISTS (
          SELECT 1 FROM alert_auto_analysis aa WHERE aa.alert_id = a.id
        )
      ORDER BY
        CASE a.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END ASC,
        a.created_at ASC
      LIMIT 3
    `).all() as { id: string; title: string; severity: string; source: string }[];
    return rows.filter(r => !this.processingIds.has(r.id));
  }

  /** 根据告警查找关联设备（优先 network_devices，再查 servers） */
  private findDeviceByAlert(alertId: string): DeviceInfo | null {
    // 1. 查 alert_device_associations
    const assoc = db.prepare(`
      SELECT ad.device_type, ad.device_id
      FROM alert_device_associations ad
      WHERE ad.alert_id = ?
    `).get(alertId) as { device_type: 'server' | 'network_device'; device_id: string } | undefined;

    if (assoc) {
      if (assoc.device_type === 'network_device') {
        const nd = db.prepare(`
          SELECT id, name, ip_address, username, password, ssh_port, enable_password
          FROM network_devices WHERE id = ?
        `).get(assoc.device_id) as any;
        if (nd && nd.username) {
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
        const sv = db.prepare('SELECT id, name, hostname, username, password, port AS ssh_port FROM servers WHERE id = ?').get(assoc.device_id) as any;
        if (sv && sv.username) {
          return {
            id: sv.id, name: sv.name, ip_address: sv.hostname,
            username: sv.username,
            password: sv.password ? decrypt(sv.password) : undefined,
            ssh_port: sv.ssh_port || 22,
            device_type: 'server',
            auth_method: 'ssh',
          };
        }
      }
    }

    // 2. 回退：直接从 alert 的 metadata/host 字段提取 IP
    const alert = db.prepare('SELECT title, content, metadata FROM alerts WHERE id = ?').get(alertId) as any;
    if (!alert) return null;

    const metadata = safeJsonParse(alert.metadata, {});
    const possibleIps: string[] = [];

    // 从 metadata.host / annotations / labels 中找 IP
    if (metadata.host) possibleIps.push(metadata.host);
    if (metadata.labels?.instance) possibleIps.push(metadata.labels.instance);
    if (metadata.annotations?.instance) possibleIps.push(metadata.annotations.instance);

    // 从标题和内容中正则匹配 IP
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const titleIps = alert.title.match(ipRegex) || [];
    const contentIps = alert.content?.match(ipRegex) || [];
    possibleIps.push(...titleIps, ...contentIps);

    for (const ip of [...new Set(possibleIps)]) {
      // 查 network_devices
      const nd = db.prepare(
        'SELECT id, name, ip_address, username, password, ssh_port, enable_password FROM network_devices WHERE ip_address = ? AND username IS NOT NULL AND username != ?'
      ).get(ip, '') as any;
      if (nd) {
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
      const sv = db.prepare(
        'SELECT id, name, hostname, username, password, port AS ssh_port, ip_address, private_ip FROM servers WHERE (hostname = ? OR ip_address = ? OR private_ip = ?) AND username IS NOT NULL AND username != ?'
      ).get(ip, ip, ip, '') as any;
      if (sv) {
        return {
          id: sv.id, name: sv.name, ip_address: sv.hostname,
          username: sv.username,
          password: sv.password ? decrypt(sv.password) : undefined,
          ssh_port: sv.ssh_port || 22,
          device_type: 'server',
          auth_method: 'ssh',
        };
      }

      // 3. 回退到 SNMP：该 IP 没有 SSH 凭证但可能有 SNMP 监控
      const snmpDev = db.prepare(
        'SELECT d.id, d.name, d.ip_address FROM network_devices d WHERE d.ip_address = ? AND (d.username IS NULL OR d.username = ?)'
      ).get(ip, '') as any;
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
  private getDiagnosticCmds(deviceType: 'network_device' | 'server', vendor?: string): string[] {
    if (deviceType === 'server') return SERVER_CMDS;
    if (vendor && DIAG_CMDS[vendor]) return DIAG_CMDS[vendor];
    return DEFAULT_NETWORK_CMDS;
  }

  /** 通过 SSH 执行一条命令，返回 stdout */
  private sshExec(device: DeviceInfo, command: string, timeoutMs: number = 15000): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let output = '';
      conn.on('ready', () => {
        conn.exec(command, { pty: { term: 'vt100', cols: 200, rows: 50 } }, (err, stream) => {
          if (err) { conn.end(); reject(err); return; }
          stream.on('data', (data: Buffer) => { output += data.toString('utf8'); });
          stream.stderr.on('data', (data: Buffer) => { output += data.toString('utf8'); });
          stream.on('close', () => { conn.end(); resolve(output); });
        });
      });
      conn.on('error', (err) => { reject(err); });
      conn.connect({
        host: device.ip_address,
        port: device.ssh_port || 22,
        username: device.username || 'root',
        password: device.password,
        readyTimeout: timeoutMs,
      });
    });
  }

  /** 获取 SNMP 巡检数据作为分析输入 */
  private getSnmpInspectionData(deviceId: string, deviceName: string, deviceIp: string): {
    rawOutput: string;
    commands: string[];
  } {
    try {
      // 取最近 3 条 SNMP 巡检记录
      const records = db.prepare(`
        SELECT id, inspection_type, status, results, summary, commands_executed, created_at
        FROM network_inspection_history
        WHERE device_id = ?
        ORDER BY created_at DESC
        LIMIT 3
      `).all(deviceId) as any[];

      if (records.length === 0) {
        // 没有巡检记录，尝试从 snmp_interface_metrics 获取接口指标
        const metrics = db.prepare(`
          SELECT interface_name, if_index, if_speed, if_admin_status, if_oper_status,
                 if_in_octets, if_out_octets, if_in_errors, if_out_errors,
                 sampled_at
          FROM snmp_interface_metrics
          WHERE device_id = ?
          ORDER BY sampled_at DESC
          LIMIT 10
        `).all(deviceId) as any[];

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
    } catch (err: any) {
      logger.warn('获取 SNMP 巡检数据失败 (device=' + deviceId + '): ' + err.message);
      return {
        rawOutput: '【SNMP】获取设备 ' + deviceName + '(' + deviceIp + ') 巡检数据失败: ' + err.message,
        commands: ['snmp:error'],
      };
    }
  }

  /** 执行 SSH 诊断 */
  private async runSshDiagnosis(device: DeviceInfo, alertTitle: string): Promise<{
    rawOutput: string;
    commands: string[];
  }> {
    // 获取设备厂商（仅 network_devices 有 vendor 字段）
    let vendor: string | undefined;
    if (device.device_type === 'network_device') {
      const row = db.prepare('SELECT vendor FROM network_devices WHERE id = ?').get(device.id) as any;
      vendor = row?.vendor;
    }

    const cmds = this.getDiagnosticCmds(device.device_type, vendor);
    const outputParts: string[] = [];
    const executedCmds: string[] = [];

    for (const cmd of cmds) {
      try {
        const output = await this.sshExec(device, cmd);
        executedCmds.push(cmd);
        outputParts.push(`## ${cmd}\n\`\`\`\n${output.trim() || '(no output)'}\n\`\`\``);
      } catch (err: any) {
        outputParts.push(`## ${cmd}\n\`\`\`\n[ERROR] ${err.message}\n\`\`\``);
      }
    }

    // 针对告警标题的额外诊断
    const alertRelatedCmds = this.getAlertSpecificCmds(alertTitle, device.device_type);
    for (const cmd of alertRelatedCmds) {
      try {
        const output = await this.sshExec(device, cmd);
        executedCmds.push(cmd);
        outputParts.push(`## ${cmd}\n\`\`\`\n${output.trim() || '(no output)'}\n\`\`\``);
      } catch {
        // 可选命令，失败可忽略
      }
    }

    return {
      rawOutput: outputParts.join('\n\n'),
      commands: executedCmds,
    };
  }

  /** 根据告警标题生成专有诊断命令 */
  private getAlertSpecificCmds(title: string, deviceType: 'network_device' | 'server'): string[] {
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

  /** AI 分析诊断输出 */
  private async aiAnalyze(alertTitle: string, alertContent: string, rawOutput: string): Promise<{ diagnosis: string; summary: string }> {
    // ── 查知识库获取相关历史方案 ──
    let knowledgeContext = '';
    try {
      const keywords = alertTitle.split(/[\s,_-]+/).filter(Boolean).slice(0, 3).join(' ');
      const kbEntries = db.prepare(`
        SELECT title, content, solutions FROM knowledge_base
        WHERE (content LIKE ? OR title LIKE ?) AND category != 'operational'
        LIMIT 3
      `).all(`%${keywords}%`, `%${keywords}%`) as { title: string; content: string; solutions: string }[];
      if (kbEntries.length > 0) {
        knowledgeContext = '\n\n## 历史知识库参考\n' + kbEntries.map((e, i) =>
          `[${i + 1}] ${e.title}\n   方案: ${(() => { try { return JSON.parse(e.solutions).join('; '); } catch { return e.content?.substring(0, 200) || ''; } })()}`
        ).join('\n');
      }
    } catch { /* 知识库表可能不存在 */ }

    const systemPrompt = '你是一个网络运维专家。根据告警信息和设备诊断输出，判断根因并给出修复建议。先写一行摘要（50字内），再写详细诊断。4. 参考历史知识库中的方案，优先推荐已验证的修复方式';
    const prompt = `## 告警信息\n**标题**: ${alertTitle}\n**内容**: ${alertContent || '(无详细内容)'}${knowledgeContext}\n\n## 设备诊断输出\n${rawOutput.substring(0, 8000)}\n\n## 要求\n1. 判断根因\n2. 分析异常指标\n3. 给出修复建议\n4. 参考历史知识库中的方案，优先推荐已验证的修复方式`;

    try {
      const text = await generateCompletion(prompt, systemPrompt, 0.3);
      // 第一行为摘要
      const lines = text.trim().split('\n');
      const summary = lines[0].replace(/^[#*]*\s*/, '').substring(0, 100);
      return { diagnosis: text, summary };
    } catch (err: any) {
      logger.error('AI analysis failed:', err);
      return {
        diagnosis: `❌ AI 分析失败: ${err.message}`,
        summary: 'AI 分析不可用',
      };
    }
  }

  /** 分析单个告警的完整流程 */
  async analyzeAlert(alertId: string): Promise<AutoAnalysisResult | null> {
    if (this.processingIds.has(alertId)) {
      logger.debug(`Alert ${alertId} is already being analyzed`);
      return null;
    }

    const startTime = Date.now();
    this.processingIds.add(alertId);

    const analysisId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record: AutoAnalysisResult = {
      id: analysisId,
      alert_id: alertId,
      device_id: '',
      device_name: '',
      device_ip: '',
      device_type: 'network_device',
      status: 'running',
      diagnosis: '',
      summary: '',
      raw_output: '',
      commands_executed: [],
      duration_ms: 0,
      created_at: new Date().toISOString(),
    };

    try {
      // 先写入 running 状态
      this.saveRecord(record);

      const alert = db.prepare('SELECT title, content, metadata, severity FROM alerts WHERE id = ?').get(alertId) as any;
      if (!alert) {
        record.status = 'failed';
        record.error_message = '告警不存在';
        this.saveRecord(record);
        return record;
      }

      // 查找设备
      const device = this.findDeviceByAlert(alertId);
      if (!device) {
        record.status = 'failed';
        record.error_message = '未找到关联设备或无 SSH/SNMP 凭证，无法分析';
        record.summary = record.error_message;
        this.saveRecord(record);
        return record;
      }

      record.device_id = device.id;
      record.device_name = device.name;
      record.device_ip = device.ip_address;
      record.device_type = device.device_type;

      // 根据设备认证方式选择诊断路径
      let rawOutput = '';
      let commands: string[] = [];

      if (device.auth_method === 'ssh') {
        // SSH 登录并执行诊断
        logger.info(`🔐 SSH 诊断: ${device.name}(${device.ip_address}) 告警: ${alert.title}`);
        const result = await this.runSshDiagnosis(device, alert.title);
        rawOutput = result.rawOutput;
        commands = result.commands;
      } else if (device.auth_method === 'snmp') {
        // SNMP 巡检数据作为分析输入
        logger.info(`🔍 SNMP 巡检: ${device.name}(${device.ip_address}) 告警: ${alert.title}`);
        const snmpData = this.getSnmpInspectionData(device.id, device.name, device.ip_address);
        rawOutput = snmpData.rawOutput;
        commands = snmpData.commands;
      }

      record.raw_output = rawOutput;
      record.commands_executed = commands;

      // AI 分析
      logger.info(`🤖 AI 分析告警: ${alert.title}`);
      const { diagnosis, summary } = await this.aiAnalyze(alert.title, alert.content || '', rawOutput);
      record.diagnosis = diagnosis;
      record.summary = summary;
      record.status = 'completed';

      // 自动上报告警已关联分析
      db.prepare('UPDATE alerts SET updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(alertId);

      logger.info(`✅ 告警自动分析完成: ${alertId} → ${summary}`);

      // ── SSH 设备 → 自动触发修复工作流 ──
      if (device.auth_method === 'ssh') {
        try {
          const matching = await remediationService.matchAlertToPolicies({
            id: alertId,
            source: alert.source || 'itops',
            severity: alert.severity,
            title: alert.title,
            content: alert.content,
          });
          if (matching.length > 0) {
            logger.info(`🔧 匹配到 ${matching.length} 条修复策略，触发自动修复`);
            for (const policy of matching) {
              await remediationService.triggerRemediation(policy, {
                id: alertId,
                source: alert.source || 'itops',
                severity: alert.severity,
                title: alert.title,
                content: alert.content,
              });
            }
          } else {
            logger.info(`⏭️ SSH 设备 ${device.name} 无匹配修复策略，跳过`);
          }
        } catch (remediationErr: any) {
          logger.error(`❌ 触发修复工作流失败: ${remediationErr.message}`, remediationErr);
        }
      }
    } catch (err: any) {
      logger.error(`Alert auto-analysis failed for ${alertId}:`, err);
      record.status = 'failed';
      record.error_message = err.message;
      record.summary = err.message.substring(0, 100);
    }

    record.duration_ms = Date.now() - startTime;
    this.saveRecord(record);
    this.processingIds.delete(alertId);
    return record;
  }

  /** 持久化分析记录 */
  private saveRecord(record: AutoAnalysisResult): void {
    db.prepare(`
      INSERT OR REPLACE INTO alert_auto_analysis
        (id, alert_id, device_id, device_name, device_ip, device_type, status, diagnosis, summary, raw_output, commands_executed, error_message, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.alert_id,
      record.device_id,
      record.device_name,
      record.device_ip,
      record.device_type,
      record.status,
      record.diagnosis || null,
      record.summary || null,
      record.raw_output || null,
      JSON.stringify(record.commands_executed),
      record.error_message || null,
      record.duration_ms,
      record.created_at
    );
  }

  /** 轮询新告警 */
  private async poll(): Promise<void> {
    try {
      const pending = this.fetchPendingAlerts();
      if (pending.length === 0) return;

      logger.info(`🔍 发现 ${pending.length} 条待分析告警`);
      for (const alert of pending) {
        await this.analyzeAlert(alert.id);
        // 每条间隔 3 秒，避免打满 SSH
        await new Promise(r => setTimeout(r, 3000));
      }
    } catch (err: any) {
      logger.error('Alert auto-analyzer poll error:', err);
    }
  }

  /** 启动自动分析服务 */
  start(): void {
    this.ensureTable();
    if (this.timer) return;

    logger.info('🤖 告警自动分析服务已启动（每 15 秒轮询）');

    // 启动后立即检查一次
    setTimeout(() => this.poll(), 3000);

    this.timer = setInterval(() => this.poll(), this.POLL_INTERVAL_MS);
  }

  /** 停止服务 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('⏹ 告警自动分析服务已停止');
    }
  }

  /** 获取分析记录列表 */
  getAnalysisHistory(limit: number = 50): AutoAnalysisResult[] {
    return db.prepare(`
      SELECT * FROM alert_auto_analysis ORDER BY created_at DESC LIMIT ?
    `).all(limit) as AutoAnalysisResult[];
  }

  /** 根据告警 ID 获取分析记录 */
  getByAlertId(alertId: string): AutoAnalysisResult | undefined {
    return db.prepare(
      'SELECT * FROM alert_auto_analysis WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(alertId) as AutoAnalysisResult | undefined;
  }
}

// ====================== 工具函数 ======================

function safeJsonParse(str: string | null | undefined, fallback: any = null): any {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ====================== 导出 ======================

export const alertAutoAnalyzer = new AlertAutoAnalyzer();
