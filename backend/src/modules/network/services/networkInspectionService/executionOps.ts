/**
 * networkInspectionService 执行子模块（2026-07-21 拆分）
 *
 * 把主类 3 个 execute*Inspection 私有方法抽为模块级纯函数：
 * - executeStandardInspection
 * - executeCustomInspection
 * - executeCustomDescriptionInspection
 *
 * 通过 shellOps 模块的 connectToDevice/runCommandsViaShell/extractCommandOutput
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { Client } from 'ssh2';
import { logger } from '../../../../utils/logger';
import { createVendorAdapter } from '../vendorAdapter';
import { getParser } from '../networkResultParser';
import type { ParsedResult } from '../networkResultParser';
import type { DeviceInfo } from '../networkInspectionService';
import type { InspectionType } from '../vendorAdapter';
import { networkCommandGenerator } from '../networkCommandGenerator';
import {
  connectToDevice,
  disconnect,
  runCommandsViaShell,
  extractCommandOutput,
} from './shellOps';

/** 执行标准巡检（厂商默认命令集） */
export async function executeStandardInspection(device: DeviceInfo): Promise<ParsedResult[]> {
  const adapter = createVendorAdapter(device.vendor);
  const commands = adapter.getCommands();
  const results: ParsedResult[] = [];

  let conn: Client | null = null;

  try {
    conn = await connectToDevice(device);
    const shellOutput = await runCommandsViaShell(conn, device, commands.map((c) => c.command));

    for (const cmd of commands) {
      const cmdOutput = extractCommandOutput(shellOutput, cmd.command);

      if (cmdOutput) {
        const parser = getParser(device.vendor, cmd.type);
        const parsed = parser(cmdOutput);
        results.push(parsed);
      } else {
        logger.warn(`无法从 shell 输出中提取命令: ${cmd.command}`);
        results.push({
          type: cmd.type,
          success: false,
          status: 'error',
          details: `${cmd.name}: 无法解析命令输出`,
          rawOutput: '',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    logger.error(`Standard inspection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    for (const cmd of commands) {
      results.push({
        type: cmd.type,
        success: false,
        status: 'error',
        details: `命令执行失败: ${cmd.command} - ${error instanceof Error ? error.message.substring(0, 100) : 'Unknown'}`,
        rawOutput: '',
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    if (conn) {
      disconnect(conn);
    }
  }

  return results;
}

/** 执行自定义类型巡检（用户选择 InspectionType 子集） */
export async function executeCustomInspection(device: DeviceInfo, types: InspectionType[]): Promise<ParsedResult[]> {
  const adapter = createVendorAdapter(device.vendor);
  const commands = adapter.getCommands(types);
  const results: ParsedResult[] = [];

  if (commands.length === 0) return results;

  let conn: Client | null = null;

  try {
    conn = await connectToDevice(device);
    const shellOutput = await runCommandsViaShell(conn, device, commands.map((c) => c.command));

    for (const cmd of commands) {
      const cmdOutput = extractCommandOutput(shellOutput, cmd.command);
      if (cmdOutput) {
        const parser = getParser(device.vendor, cmd.type);
        const parsed = parser(cmdOutput);
        results.push(parsed);
      } else {
        results.push({
          type: cmd.type,
          success: false,
          status: 'error',
          details: `${cmd.name}: 无法解析命令输出`,
          rawOutput: '',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (_error) {
    void _error;
    for (const cmd of commands) {
      results.push({
        type: cmd.type,
        success: false,
        status: 'error',
        details: `命令执行失败: ${cmd.command}`,
        rawOutput: '',
        timestamp: new Date().toISOString(),
      });
    }
  } finally {
    if (conn) disconnect(conn);
  }

  return results;
}

/** 执行描述式巡检（AI 生成命令 + fallback 标准命令） */
export async function executeCustomDescriptionInspection(device: DeviceInfo, description: string): Promise<ParsedResult[]> {
  const adapter = createVendorAdapter(device.vendor);
  const generatedCommands = await networkCommandGenerator.generateCommands(device.vendor, description);
  const results: ParsedResult[] = [];

  let conn: Client | null = null;

  try {
    conn = await connectToDevice(device);

    if (generatedCommands.length > 0) {
      const shellOutput = await runCommandsViaShell(conn, device, generatedCommands.map((c) => c.command));

      for (const cmd of generatedCommands) {
        const cmdOutput = extractCommandOutput(shellOutput, cmd.command);
        if (cmdOutput) {
          const parser = getParser(device.vendor, 'version');
          const parsed = parser(cmdOutput);
          parsed.details = cmd.purpose;
          results.push(parsed);
        } else {
          results.push({
            type: 'version',
            success: false,
            status: 'error',
            details: `AI生成命令执行失败: ${cmd.command} (${cmd.purpose})`,
            rawOutput: '',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (generatedCommands.length === 0) {
      logger.warn('No commands generated for custom description, using fallback');
      const fallbackCommands = adapter.getCommands().slice(0, 3);
      const fallbackShellOutput = await runCommandsViaShell(conn, device, fallbackCommands.map((c) => c.command));
      for (const cmd of fallbackCommands) {
        const cmdOutput = extractCommandOutput(fallbackShellOutput, cmd.command);
        if (cmdOutput) {
          results.push(getParser(device.vendor, cmd.type)(cmdOutput));
        }
      }
    }
  } finally {
    if (conn) disconnect(conn);
  }

  return results;
}
