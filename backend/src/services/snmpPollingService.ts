/**
 * =============================================================================
 * ITOps Agent Platform - SNMP 轮询巡检服务
 * =============================================================================
 * 对启用 SNMP 的网络设备定时进行轮询采集，包括：
 * 1. 设备可达性检查
 * 2. 系统基本信息（名称、描述、运行时间）
 * 3. 接口列表及状态
 * 4. 接口流量计数器（含增量速率计算）
 * 5. 错误计数器
 *
 * 结果写入 network_inspection_history 表，支持在前端统一展示。
 * =============================================================================
 */

import db from '../models/database';
import { logger } from '../utils/logger';
import { decrypt } from './encryptionService';
import { snmpService, SnmpVersion } from './snmpService';

// ====================== 类型定义 ======================

export interface SnmpInterfaceMetric {
  index: number;
  name: string;
  operStatus: 'up' | 'down';
  adminStatus: 'up' | 'down';
  speed: number;            // bps
  mtu: number;
  mac: string;
  inOctets: bigint | number;
  outOctets: bigint | number;
  inErrors: number;
  outErrors: number;
  inBps: number;            // 从增量计算得到的入方向速率
  outBps: number;           // 从增量计算得到的出方向速率
  inUtilization: number;    // 入方向带宽利用率百分比
  outUtilization: number;   // 出方向带宽利用率百分比
}

export interface SnmpInspectionResult {
  reachable: boolean;
  sysName: string;
  sysDescr: string;
  sysUptime: number;
  interfaces: SnmpInterfaceMetric[];
  interfaceCount: number;
  upCount: number;
  downCount: number;
  alerts: string[];
  pollDurationMs: number;
}

interface SnmpSnapshotRow {
  device_id: string;
  interface_index: number;
  in_octets: string;
  out_octets: string;
  in_errors: number;
  out_errors: number;
  last_poll_at: string;
}

// ====================== 服务实现 ======================

class SnmpPollingService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟

  /** 确保快照表存在 */
  private ensureSnapshotTable(): void {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='snmp_polling_snapshots'"
    ).all();
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS snmp_polling_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_id TEXT NOT NULL,
          interface_index INTEGER NOT NULL,
          in_octets TEXT DEFAULT '0',
          out_octets TEXT DEFAULT '0',
          in_errors INTEGER DEFAULT 0,
          out_errors INTEGER DEFAULT 0,
          last_poll_at TEXT,
          UNIQUE(device_id, interface_index)
        )
      `);
      logger.info('✅ Created snmp_polling_snapshots table');
    }
  }

  /** 获取设备最近的快照 */
  private getSnapshots(deviceId: string): Map<number, SnmpSnapshotRow> {
    const rows = db.prepare(
      'SELECT * FROM snmp_polling_snapshots WHERE device_id = ?'
    ).all(deviceId) as SnmpSnapshotRow[];
    const map = new Map<number, SnmpSnapshotRow>();
    for (const row of rows) {
      map.set(row.interface_index, row);
    }
    return map;
  }

  /** 保存接口快照 */
  private saveSnapshots(deviceId: string, interfaces: SnmpInterfaceMetric[]): void {
    const now = new Date().toISOString();
    const upsert = db.prepare(`
      INSERT INTO snmp_polling_snapshots (device_id, interface_index, in_octets, out_octets, in_errors, out_errors, last_poll_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id, interface_index) DO UPDATE SET
        in_octets = excluded.in_octets,
        out_octets = excluded.out_octets,
        in_errors = excluded.in_errors,
        out_errors = excluded.out_errors,
        last_poll_at = excluded.last_poll_at
    `);

    const tx = db.transaction(() => {
      for (const iface of interfaces) {
        upsert.run(
          deviceId,
          iface.index,
          String(iface.inOctets),
          String(iface.outOctets),
          iface.inErrors,
          iface.outErrors,
          now
        );
      }
    });
    tx();
  }

  /** 计算接口速率（bps），基于当前值和上一轮快照的差值 */
  private computeRates(
    current: SnmpInterfaceMetric,
    prev: SnmpSnapshotRow | undefined,
    intervalSeconds: number
  ): { inBps: number; outBps: number } {
    if (!prev) {
      return { inBps: 0, outBps: 0 };
    }
    const prevIn = BigInt(prev.in_octets || '0');
    const prevOut = BigInt(prev.out_octets || '0');
    const curIn = BigInt(current.inOctets);
    const curOut = BigInt(current.outOctets);

    if (intervalSeconds <= 0) return { inBps: 0, outBps: 0 };

    const deltaIn = curIn >= prevIn ? Number(curIn - prevIn) : 0;
    const deltaOut = curOut >= prevOut ? Number(curOut - prevOut) : 0;

    return {
      inBps: Math.round(deltaIn / intervalSeconds),
      outBps: Math.round(deltaOut / intervalSeconds),
    };
  }

  /** 对单个设备执行 SNMP 巡检 */
  async inspectDevice(deviceId: string): Promise<SnmpInspectionResult | null> {
    const startTime = Date.now();

    // 获取设备信息
    const device = db.prepare(
      `SELECT nd.*, sc.snmp_version, sc.community, sc.snmp_user, sc.snmp_auth_protocol,
              sc.snmp_auth_key, sc.snmp_priv_protocol, sc.snmp_priv_key
       FROM network_devices nd
       LEFT JOIN snmp_credentials sc ON nd.snmp_credential_id = sc.id
       WHERE nd.id = ? AND nd.snmp_enabled = 1`
    ).get(deviceId) as any;

    if (!device) {
      logger.warn(`SNMP poll skipped: device ${deviceId} not found or SNMP disabled`);
      return null;
    }

    const host = device.ip_address;
    const port = device.snmp_port || 161;
    const version: SnmpVersion = device.snmp_version || 'v2c';
    const community = device.community ? decrypt(device.community) : 'public';

    try {
      // 并行获取系统信息和接口列表
      const [sysInfo, interfaces] = await Promise.all([
        snmpService.getSystemInfo(
          host, port, version,
          version !== 'v3' ? community : undefined
        ).catch(() => null),
        snmpService.getInterfaces(
          host, port, version,
          version !== 'v3' ? community : undefined
        ).catch(() => [])
      ]);

      if (!sysInfo && interfaces.length === 0) {
        // 设备完全无法通过 SNMP 连接
        const result: SnmpInspectionResult = {
          reachable: false,
          sysName: '',
          sysDescr: '',
          sysUptime: 0,
          interfaces: [],
          interfaceCount: 0,
          upCount: 0,
          downCount: 0,
          alerts: ['❌ SNMP 连接失败，设备无法响应'],
          pollDurationMs: Date.now() - startTime,
        };
        this.saveInspectionResult(deviceId, result);
        return result;
      }

      // 获取上一次的快照用于速率计算
      const prevSnapshots = this.getSnapshots(deviceId);
      const now = Date.now();

      // 处理接口数据，计算速率
      const metrics: SnmpInterfaceMetric[] = [];
      const alerts: string[] = [];

      for (const iface of interfaces) {
        const prev = prevSnapshots.get(iface.index);
        const prevPollAt = prev?.last_poll_at
          ? new Date(prev.last_poll_at).getTime()
          : now - this.POLL_INTERVAL_MS;
        const intervalSec = Math.max(30, Math.round((now - prevPollAt) / 1000));

        const rates = this.computeRates(iface as any, prev, intervalSec);

        const inUtil = iface.speed > 0
          ? Math.min(100, (rates.inBps * 8 / iface.speed) * 100)
          : 0;
        const outUtil = iface.speed > 0
          ? Math.min(100, (rates.outBps * 8 / iface.speed) * 100)
          : 0;

        metrics.push({
          index: iface.index,
          name: iface.name,
          operStatus: iface.operStatus,
          adminStatus: iface.adminStatus,
          speed: iface.speed,
          mtu: iface.mtu,
          mac: iface.mac,
          inOctets: iface.inOctets,
          outOctets: iface.outOctets,
          inErrors: iface.inErrors,
          outErrors: iface.outErrors,
          inBps: rates.inBps,
          outBps: rates.outBps,
          inUtilization: Math.round(inUtil * 100) / 100,
          outUtilization: Math.round(outUtil * 100) / 100,
        });

        // 告警检测
        if (iface.adminStatus === 'up' && iface.operStatus === 'down') {
          alerts.push(`⚠️ ${iface.name} - 管理状态 UP 但运行状态 DOWN`);
        }
        if (iface.adminStatus === 'up' && iface.operStatus === 'up' &&
            iface.inErrors > 0 && prev && iface.inErrors > (prev.in_errors || 0)) {
          const errDelta = iface.inErrors - (prev.in_errors || 0);
          if (errDelta > 100) {
            alerts.push(`⚠️ ${iface.name} - 入方向错误包激增（+${errDelta}）`);
          }
        }
      }

      // 保存当前快照
      this.saveSnapshots(deviceId, metrics);

      const upCount = metrics.filter(i => i.operStatus === 'up').length;
      const downCount = metrics.filter(i => i.operStatus === 'down').length;

      const result: SnmpInspectionResult = {
        reachable: true,
        sysName: sysInfo?.sysName || 'unknown',
        sysDescr: sysInfo?.sysDescr || '',
        sysUptime: sysInfo?.sysUptime || 0,
        interfaces: metrics,
        interfaceCount: metrics.length,
        upCount,
        downCount,
        alerts,
        pollDurationMs: Date.now() - startTime,
      };

      this.saveInspectionResult(deviceId, result);
      return result;
    } catch (error: any) {
      logger.error(`SNMP inspect failed for device ${deviceId}:`, error);
      const result: SnmpInspectionResult = {
        reachable: false,
        sysName: '',
        sysDescr: '',
        sysUptime: 0,
        interfaces: [],
        interfaceCount: 0,
        upCount: 0,
        downCount: 0,
        alerts: [`❌ 巡检异常: ${error.message}`],
        pollDurationMs: Date.now() - startTime,
      };
      this.saveInspectionResult(deviceId, result);
      return result;
    }
  }

  /** 将结果写入巡检历史表，并更新设备的上次巡检信息 */
  private saveInspectionResult(deviceId: string, result: SnmpInspectionResult): void {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const summary = result.reachable
      ? `SNMP 可达 | ${result.interfaceCount} 个接口（${result.upCount} UP / ${result.downCount} DOWN）${result.alerts.length > 0 ? ' | ' + result.alerts.length + ' 条告警' : ''}`
      : 'SNMP 连接失败';
    const status = result.reachable ? 'completed' : 'failed';
    const alertsJson = result.alerts.length > 0 ? JSON.stringify(result.alerts) : '[]';

    db.prepare(`
      INSERT INTO network_inspection_history
        (id, device_id, inspection_type, status, commands_executed, commands_failed, results, summary, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      deviceId,
      'snmp',
      status,
      result.interfaceCount,          // commands_executed = 接口数
      result.alerts.length,           // commands_failed = 告警数
      JSON.stringify(result),         // results = 全量 JSON
      summary,
      result.pollDurationMs
    );

    // 更新设备的上次巡检时间与摘要
    db.prepare('UPDATE network_devices SET last_inspection_at = datetime(?), last_inspection_result = ? WHERE id = ?')
      .run(new Date().toISOString(), summary, deviceId);
  }

  /** 轮询所有启用 SNMP 的设备 */
  async pollAll(): Promise<void> {
    const devices = db.prepare(
      'SELECT id, name, ip_address FROM network_devices WHERE snmp_enabled = 1'
    ).all() as { id: string; name: string; ip_address: string }[];

    if (devices.length === 0) {
      logger.debug('SNMP poll: no devices with SNMP enabled');
      return;
    }

    logger.info(`🔁 SNMP 巡检开始: ${devices.length} 台设备`);

    // 顺序轮询避免风暴
    const results: { device: string; ip: string; ok: boolean }[] = [];
    for (const device of devices) {
      try {
        const result = await this.inspectDevice(device.id);
        results.push({
          device: device.name,
          ip: device.ip_address,
          ok: result?.reachable ?? false,
        });
        // 设备间留 200ms 间隔，避免 SNMP 拥塞
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        results.push({ device: device.name, ip: device.ip_address, ok: false });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    logger.info(`✅ SNMP 巡检完成: ${okCount}/${devices.length} 可达`);
  }

  /** 启动定时轮询 */
  start(): void {
    this.ensureSnapshotTable();

    if (this.timer) return;

    logger.info(`🔁 SNMP 轮询服务已启动（每 ${this.POLL_INTERVAL_MS / 1000 / 60} 分钟）`);

    // 启动后先立即执行一次
    setTimeout(() => {
      this.pollAll().catch(err => {
        logger.error('SNMP initial poll failed:', err);
      });
    }, 5000);

    this.timer = setInterval(() => {
      this.pollAll().catch(err => {
        logger.error('SNMP scheduled poll failed:', err);
      });
    }, this.POLL_INTERVAL_MS);
  }

  /** 停止定时轮询 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('⏹ SNMP 轮询服务已停止');
    }
  }
}

// ====================== 导出单例 ======================

export const snmpPollingService = new SnmpPollingService();
