/**
 * AI 命令生成相关的纯函数工具
 *
 * 这些函数无状态、可独立测试，与 useServerActions 解耦以降低主 Hook 体积。
 */
import type { Server } from '../types';

export interface ServerInfo {
  os_name: string;
  os_type: 'linux' | 'windows' | string;
  hostname: string;
  ip_address: string;
  cpu_cores: string | number;
  memory_gb: string | number;
  disk_gb: string | number;
}

/**
 * 构造 AI 命令生成的 user prompt
 */
export function buildAiCommandPrompt(server: Server, userRequest: string): string {
  const info: ServerInfo = {
    os_name: server.os || '未知',
    os_type: server.os_type || 'linux',
    hostname: server.hostname || '',
    ip_address: server.ip_address || '',
    cpu_cores: server.cpu_cores || '',
    memory_gb: server.memory_gb || '',
    disk_gb: server.disk_gb || '',
  };

  return `目标服务器信息：
操作系统名称：${info.os_name}
操作系统类型：${info.os_type}
主机名/IP：${info.hostname || info.ip_address}
${info.cpu_cores ? `CPU核心数：${info.cpu_cores}` : ''}
${info.memory_gb ? `内存大小：${info.memory_gb}GB` : ''}
${info.disk_gb ? `磁盘大小：${info.disk_gb}GB` : ''}

用户需求：${userRequest}`;
}

/**
 * 从 AI 输出中提取 JSON 命令
 */
export function parseAiCommandOutput(output: string): { command: string; explanation: string } {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      return {
        command: result.command || '',
        explanation: result.explanation || '',
      };
    } catch {
      // 忽略 JSON 解析失败
    }
  }
  return {
    command: output,
    explanation: 'AI 生成的命令，请确认后执行',
  };
}

/**
 * 从 Agent 列表中查找命令生成 Agent
 */
export function pickCommandGenerationAgent(agents: Array<{ id: string; name?: string; enabled?: number | boolean; category?: string }> | undefined): { id: string; name: string } | null {
  if (!agents || agents.length === 0) return null;
  const isEnabled = (a: { enabled?: number | boolean }) => a.enabled === 1 || a.enabled === true;

  const cmdAgent = agents.find(
    (a) => isEnabled(a) && (a.name?.includes('命令生成') || a.category?.includes('命令生成'))
  );
  if (cmdAgent) return { id: cmdAgent.id, name: cmdAgent.name || cmdAgent.id };

  const serverAgent = agents.find(
    (a) =>
      isEnabled(a) &&
      (a.category?.includes('服务器') || a.name?.includes('命令') || a.name?.includes('服务'))
  );
  if (serverAgent) return { id: serverAgent.id, name: serverAgent.name || serverAgent.id };

  const firstAgent = agents.find(isEnabled);
  if (firstAgent) return { id: firstAgent.id, name: firstAgent.name || firstAgent.id };

  return null;
}