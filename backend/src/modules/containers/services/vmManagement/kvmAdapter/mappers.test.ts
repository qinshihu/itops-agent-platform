/**
 * kvmAdapter/mappers 测试
 *
 * 验证：
 *   - parseVirshList 解析 virsh list 输出（含表头跳过）
 *   - parseStats 解析 key=value 格式统计
 *   - mapVirshStatus 状态映射
 *   - mapVirshPowerState 电源状态映射
 */

import { describe, it, expect } from 'vitest';
import {
  parseVirshList,
  parseStats,
  mapVirshStatus,
  mapVirshPowerState,
} from './mappers';

describe('parseVirshList', () => {
  it('解析标准 virsh list --all 输出', () => {
    const output = ` Id   Name        State
----------------------------------------------------
 1    vm1         running
 2    vm2         shut off
 -    vm3         paused`;

    const result = parseVirshList(output);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: '1', name: 'vm1', state: 'running' });
    expect(result[1]).toEqual({ id: '2', name: 'vm2', state: 'shut_off' });
  });

  it('空输出返回空数组', () => {
    expect(parseVirshList('')).toEqual([]);
  });

  it('无表头行时返回空', () => {
    expect(parseVirshList('1 vm1 running')).toEqual([]);
  });
});

describe('parseStats', () => {
  it('解析 key=value 格式', () => {
    const output = `
cpu.time=123456789
balloon.current=1048576
block.0.allocation=20480
net.0.rx.bytes=1024
net.0.tx.bytes=512
`;
    const result = parseStats(output);
    expect(result.memKB).toBe(1048576);
    expect(result.diskAllocKB).toBe(20480);
    expect(result.netRxBytes).toBe(1024);
    expect(result.netTxBytes).toBe(512);
  });

  it('空输出返回全 0', () => {
    const result = parseStats('');
    expect(result.cpuPercent).toBe(0);
    expect(result.memKB).toBe(0);
  });

  it('无效值回退为 0', () => {
    const result = parseStats('balloon.current=abc');
    expect(result.memKB).toBe(0);
  });
});

describe('mapVirshStatus', () => {
  it('running → running', () => {
    expect(mapVirshStatus('running')).toBe('running');
  });

  it('shut off → stopped', () => {
    expect(mapVirshStatus('shut off')).toBe('stopped');
    expect(mapVirshStatus('shutoff')).toBe('stopped');
  });

  it('paused → paused', () => {
    expect(mapVirshStatus('paused')).toBe('paused');
  });

  it('pmsuspended → suspended', () => {
    expect(mapVirshStatus('pmsuspended')).toBe('suspended');
  });

  it('未知 → unknown', () => {
    expect(mapVirshStatus('crashed')).toBe('unknown');
  });
});

describe('mapVirshPowerState', () => {
  it('running → poweredOn', () => {
    expect(mapVirshPowerState('running')).toBe('poweredOn');
  });

  it('shut off → poweredOff', () => {
    expect(mapVirshPowerState('shut off')).toBe('poweredOff');
  });

  it('paused → poweredOn（暂停视为开机）', () => {
    expect(mapVirshPowerState('paused')).toBe('poweredOn');
  });

  it('suspended → suspended', () => {
    expect(mapVirshPowerState('suspended')).toBe('suspended');
  });

  it('未知 → unknown', () => {
    expect(mapVirshPowerState('crashed')).toBe('unknown');
  });
});
