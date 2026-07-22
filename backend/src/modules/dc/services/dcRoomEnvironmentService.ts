/**
 * dcRoomEnvironmentService — 机房环境数据采集
 *
 * 职责：定时采集机房温湿度、PDU 功率、馈线负载，写回 dc_rooms / dc_pdus / dc_power_feeds。
 *
 * 当前实现：模拟数据（带趋势的随机游走），保证总览页面有可见数据。
 * 真实接入：可在 `pollRoomEnvironment()` 内部替换 SNMP/IPMI/Modbus 调用。
 *
 * 启动/停止由 dcStatusService 协同管理（在 startDCStatusPush 中启动）。
 */

// TODO v2.5 (工单：dcDataCollectionRepository 拆分)：本文件是 dc 模块后台机房环境采集任务，
// 需要直连 db 写机房温湿度、PDU 功率、馈线负载等实时数据。
// 计划抽到 repositories/dcRepository/dcCollectionRepo.ts（与 dcPduSnmpService 合并处理）。
// 预计工时 4h（参考 ADR-020 §六 v2.5）。
/* eslint-disable no-restricted-imports -- 临时豁免，等 repository 拆分后撤销 */

import { logger } from '../../../utils/logger';
import db from '../../../models/database';

let intervalId: ReturnType<typeof setInterval> | null = null;

/** 带趋势的随机游走：当前值 ± 步长，clamp 到 [min, max] */
function walk(current: number, min: number, max: number, step: number): number {
  const next = current + (Math.random() - 0.5) * step * 2;
  return Math.max(min, Math.min(max, next));
}

/**
 * 机房温湿度模拟采集
 *   - 温度 18~28°C
 *   - 湿度 30~70%
 *   - PUE 1.2~1.8
 *   - 总功率随设备数推算
 */
function pollRoomEnvironment() {
  try {
    const rooms = db.prepare(`
      SELECT id, current_temperature, current_humidity, pue, total_power_kw
      FROM dc_rooms
    `).all() as Array<{
      id: string;
      current_temperature: number | null;
      current_humidity: number | null;
      pue: number;
      total_power_kw: number;
    }>;

    for (const r of rooms) {
      const temp = walk(r.current_temperature ?? 24, 18, 28, 0.5);
      const hum = walk(r.current_humidity ?? 50, 30, 70, 2);
      const pue = walk(r.pue || 1.45, 1.2, 1.8, 0.05);
      // 按机柜 + 设备估算功率
      const rackCount = (db.prepare(
        'SELECT COUNT(*) as c FROM dc_racks WHERE room_id = ?'
      ).get(r.id) as { c: number }).c;
      const totalPower = rackCount * 3.2; // 假设每机柜平均 3.2kW

      db.prepare(`
        UPDATE dc_rooms
        SET current_temperature = ?, current_humidity = ?, pue = ?, total_power_kw = ?
        WHERE id = ?
      `).run(temp, hum, pue, totalPower, r.id);
    }

    if (rooms.length > 0) {
      logger.debug(`🌡️  采集机房环境: ${rooms.length} 个机房`);
    }
  } catch (err) {
    logger.error('Room environment poll error:', err as Error);
  }
}

/**
 * PDU/馈线负载模拟采集
 *   - PDU current_load_w 在 [power_capacity_w * 0.3, power_capacity_w * 0.8] 之间游走
 *   - 馈线 current_load_w 在 [max_utilization_pct * voltage * amperage / 100, ...] 之间游走
 */
function pollPowerLoad() {
  try {
    // PDU
    const pdus = db.prepare(`
      SELECT id, power_capacity_w, current_load_w FROM dc_pdus WHERE power_capacity_w > 0
    `).all() as Array<{ id: string; power_capacity_w: number; current_load_w: number }>;
    for (const p of pdus) {
      const target = p.power_capacity_w * (0.3 + Math.random() * 0.5); // 30%~80%
      const next = walk(p.current_load_w || target, 0, p.power_capacity_w, p.power_capacity_w * 0.02);
      db.prepare('UPDATE dc_pdus SET current_load_w = ? WHERE id = ?').run(next, p.id);
    }

    // 馈线
    const feeds = db.prepare(`
      SELECT id, voltage, amperage, max_utilization_pct, current_load_w
      FROM dc_power_feeds WHERE voltage > 0 AND amperage > 0
    `).all() as Array<{
      id: string; voltage: number; amperage: number;
      max_utilization_pct: number; current_load_w: number;
    }>;
    for (const f of feeds) {
      const maxW = f.voltage * f.amperage * (f.max_utilization_pct / 100);
      const target = maxW * (0.3 + Math.random() * 0.5);
      const next = walk(f.current_load_w || target, 0, maxW, maxW * 0.02);
      db.prepare('UPDATE dc_power_feeds SET current_load_w = ? WHERE id = ?').run(next, f.id);
    }
  } catch (err) {
    logger.error('Power load poll error:', err as Error);
  }
}

/** 启动采集（默认 30s） */
export function startDCEnvironmentPoll(intervalMs = 30_000) {
  if (intervalId) return;
  logger.info(`🌡️  DC environment poll started (interval: ${intervalMs}ms)`);
  // 立即采一次
  pollRoomEnvironment();
  pollPowerLoad();
  intervalId = setInterval(() => {
    pollRoomEnvironment();
    pollPowerLoad();
  }, intervalMs);
}

export function stopDCEnvironmentPoll() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('🌡️  DC environment poll stopped');
  }
}
