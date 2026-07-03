import { randomUUID } from 'crypto';
import { serversRepo } from '../../../../repositories/serverRepository';
import type { CommandResult } from './sshTypes';

// 记录命令历史
export function logCommandHistory(
  serverId: string,
  command: string,
  result: CommandResult,
  executedBy = 'system'
): void {
  const id = randomUUID();
  serversRepo.insertCommandHistory({
    id,
    server_id: serverId,
    command,
    stdout: result.stdout,
    stderr: result.stderr,
    success: result.success ? 1 : 0,
    execution_time_ms: result.duration,
    executed_by: executedBy,
  });
}

// 更新服务器最后连接时间
export function updateLastConnected(serverId: string): void {
  serversRepo.updateLastConnected(serverId);
}

// 获取命令历史
export function getCommandHistory(serverId: string, limit = 50): Array<{
  id: string;
  server_id: string;
  command: string;
  stdout: string;
  stderr: string;
  success: number;
  execution_time_ms: number;
  executed_by: string;
}> {
  return serversRepo.listCommandHistory(serverId, limit) as Array<{
    id: string;
    server_id: string;
    command: string;
    stdout: string;
    stderr: string;
    success: number;
    execution_time_ms: number;
    executed_by: string;
  }>;
}

// 获取合规检查历史
export function getComplianceHistory(serverId: string, limit = 20): Array<{
  id: string;
  server_id: string;
  check_name: string;
  check_results: string;
  status: string;
  created_at: string;
}> {
  return serversRepo.listComplianceChecks(serverId, limit) as Array<{
    id: string;
    server_id: string;
    check_name: string;
    check_results: string;
    status: string;
    created_at: string;
  }>;
}