/**
 * 厂商适配器 — 共享辅助函数
 */

import type { CommandTemplate, DeviceType } from './types';

/** 根据 deviceType 过滤指令模板 */
export function filterByDeviceType(
  templates: CommandTemplate[],
  deviceType?: DeviceType,
): CommandTemplate[] {
  if (!deviceType || deviceType === 'unknown') return templates;
  return templates.filter(t => !t.deviceTypes || t.deviceTypes.includes(deviceType));
}
