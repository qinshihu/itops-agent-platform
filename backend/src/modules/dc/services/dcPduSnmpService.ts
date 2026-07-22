/**
 * dcPduSnmpService — PDU/UPS SNMP 真实数据采集
 *
 * 职责：从 dc_pdus 读 SNMP 配置（ip_address / snmp_community），
 *      调通用 snmpService 拿真实功率/电流/电压/温度。
 *
 * 已知 OID（多数机柜 PDU 通用，可适配不同品牌）：
 *   rfc1628（UPS MIB）:
 *     1.3.6.1.2.1.33.1.3.3.1.3.0  → upsOutputVoltage (×0.1 V)
 *     1.3.6.1.2.1.33.1.3.3.1.4.0  → upsOutputCurrent (×0.1 A)
 *     1.3.6.1.2.1.33.1.3.3.1.5.0  → upsOutputPower (W)
 *     1.3.6.1.2.1.33.1.3.3.1.6.0  → upsOutputPercentLoad (%)
 *   EATON EMP / APC PDU MIB:
 *     1.3.6.1.4.1.318.1.1.12.1.1.0  → rPDULoadStatusLoad (W)
 *     1.3.6.1.4.1.318.1.1.12.2.1.0  → rPDULoadStatusBankOutput (W)
 *
 * 不同品牌 OID 差异较大，采集时按需切换 vendor。
 *
 * 启动/停止：由 dcRoomEnvironmentService 协同管理。
 */

// TODO v2.5 (工单：dcDataCollectionRepository 拆分)：本文件是 dc 模块后台定时采集任务，
// 需要直连 db 做大批量 UPS/PDU/SNMP 实时数据写入。计划抽到
// repositories/dcRepository/dcCollectionRepo.ts（本工单一并处理 dcRoomEnvironmentService）。
// 预计工时 4h（参考 ADR-020 §六 v2.5）。
/* eslint-disable no-restricted-imports -- 临时豁免，等 repository 拆分后撤销 */

import { logger } from '../../../utils/logger';
import db from '../../../models/database';

interface PduRecord {
  id: string;
  ip_address: string | null;
  snmp_community: string | null;
  type: 'pdu' | 'ups' | null;
  power_capacity_w: number | null;
}

interface PduMetrics {
  pdu_id: string;
  ip: string;
  output_voltage?: number;  // V
  output_current?: number;  // A
  output_power_w?: number;  // W
  load_pct?: number;        // %
  status: 'ok' | 'timeout' | 'error';
  error?: string;
  polled_at: string;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * 尝试 SNMP get（用通用 snmpService）
 * 失败时静默返回 null（PDU 没配 SNMP、SNMP 库调用失败等）
 */
async function snmpGetSafe(
  ip: string,
  community: string,
  oid: string
): Promise<number | null> {
  try {
    const { snmpService } = await import('../../network/services/snmp');
    // snmpService.get(host, port, version, community, ...) 返回 SnmpResult
    const result = await snmpService.get(ip, 161, 'v2c', community, undefined, undefined, undefined, undefined, undefined, oid);
    if (result?.value !== null && result?.value !== undefined) {
      const num = Number(result.value);
      return Number.isFinite(num) ? num : null;
    }
    return null;
  } catch (err) {
    logger.debug(`SNMP get ${ip} ${oid} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 采集单个 PDU 的真实指标
 */
async function pollPdu(pdu: PduRecord): Promise<PduMetrics> {
  const ip = pdu.ip_address;
  const community = pdu.snmp_community || 'public';

  if (!ip) {
    return {
      pdu_id: pdu.id, ip: '',
      status: 'error', error: '未配置 IP',
      polled_at: new Date().toISOString(),
    };
  }

  // PDU / UPS 通用 OID（rfc1628）
  const voltage = await snmpGetSafe(ip, community, '1.3.6.1.2.1.33.1.3.3.1.3.0');
  const current = await snmpGetSafe(ip, community, '1.3.6.1.2.1.33.1.3.3.1.4.0');
  const power = await snmpGetSafe(ip, community, '1.3.6.1.2.1.33.1.3.3.1.5.0');
  const loadPct = await snmpGetSafe(ip, community, '1.3.6.1.2.1.33.1.3.3.1.6.0');

  if (power === null && voltage === null) {
    return {
      pdu_id: pdu.id, ip,
      status: 'timeout',
      error: 'SNMP 响应超时或 OID 不支持',
      polled_at: new Date().toISOString(),
    };
  }

  return {
    pdu_id: pdu.id, ip,
    output_voltage: voltage !== null && voltage !== undefined ? voltage / 10 : undefined,    // 0.1V → V
    output_current: current !== null && current !== undefined ? current / 10 : undefined,    // 0.1A → A
    output_power_w: power ?? undefined,
    load_pct: loadPct ?? undefined,
    status: 'ok',
    polled_at: new Date().toISOString(),
  };
}

/**
 * 采集所有 PDU 的真实指标
 *   - 调 snmpService 拉数据
 *   - 写回 dc_pdus.current_load_w
 *   - 失败时静默跳过（SNMP 不可用 ≠ 服务异常）
 */
async function pollAllPdus() {
  try {
    const pdus = db.prepare(`
      SELECT id, ip_address, snmp_community, type, power_capacity_w
      FROM dc_pdus
      WHERE ip_address IS NOT NULL AND ip_address != ''
    `).all() as PduRecord[];

    if (pdus.length === 0) return;

    const results = await Promise.all(pdus.map(pollPdu));
    let updated = 0;
    for (const r of results) {
      if (r.status === 'ok' && typeof r.output_power_w === 'number') {
        db.prepare('UPDATE dc_pdus SET current_load_w = ? WHERE id = ?')
          .run(r.output_power_w, r.pdu_id);
        updated++;
      }
    }
    if (updated > 0) {
      logger.debug(`🔌 PDU SNMP 采集: ${updated}/${pdus.length} 个 PDU 更新成功`);
    }
  } catch (err) {
    logger.error('PDU SNMP poll error:', err as Error);
  }
}

/** 启动 PDU SNMP 采集（默认 60s） */
export function startDcPduSnmpPoll(intervalMs = 60_000) {
  if (intervalId) return;
  logger.info(`🔌 DC PDU SNMP poll started (interval: ${intervalMs}ms)`);
  pollAllPdus(); // 立即采一次
  intervalId = setInterval(pollAllPdus, intervalMs);
}

export function stopDcPduSnmpPoll() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('🔌 DC PDU SNMP poll stopped');
  }
}

/** 单元测试用：暴露内部函数 */
export const __test = { pollPdu, pollAllPdus };
