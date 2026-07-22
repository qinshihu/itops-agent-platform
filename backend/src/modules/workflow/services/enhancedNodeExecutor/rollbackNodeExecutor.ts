/**
 * Rollback 节点执行器：自动回滚
 *
 * 从原 enhancedNodeExecutor.ts 拆分（2026-07-08 P1-7 拆分）。
 * 从前置节点提取回滚命令，通过 SSH 顺序执行并写审计日志。
 */
import { executeCommand } from '../../../servers/services/sshService/index';
import { createAuditLog } from '../../../audit/services/auditService';
import type { NodeResult } from '../../../../types';
import type { RollbackNodeConfig } from '../enhancedNodeTypes';
import { getErrorMessage } from '../../../../utils/errorHelpers';

export async function executeRollbackNode(
  config: RollbackNodeConfig,
  nodeResults: Record<string, NodeResult>
): Promise<NodeResult> {
  const serverId = config.server_id;
  if (!serverId) {
    return { status: 'failed', error: '未指定服务器ID，无法执行回滚' };
  }

  const cmdTimeout = config.commandTimeout || 30000;

  // 从上下文提取回滚命令
  const rollbackCommands = extractRollbackCommands(config, nodeResults);
  if (rollbackCommands.length === 0) {
    return { status: 'failed', error: '未找到回滚命令' };
  }

  const results: Array<{ command: string; success: boolean; output: string }> = [];

  for (const cmd of rollbackCommands) {
    try {
      const result = await executeCommand(serverId, cmd, { timeout: cmdTimeout });
      const output = result.stdout || result.stderr || '';
      results.push({ command: cmd, success: true, output: output.substring(0, 500) });
    } catch (err: unknown) {
      results.push({ command: cmd, success: false, output: getErrorMessage(err) || String(err) });
      // 回滚命令失败不中断，继续执行后续
    }
  }

  const allSuccess = results.every((r: { command: string; success: boolean; output: string }) => r.success);
  const output = `## 🔄 回滚执行结果\n\n` +
    results.map((r: { command: string; success: boolean; output: string }) => `- ${r.success ? '✅' : '❌'} \`${r.command.substring(0, 80)}\`\n  ${r.output.substring(0, 200)}`).join('\n');

  // 审计
  createAuditLog({
    action: 'rollback_executed',
    resource_type: 'rollback',
    resource_id: serverId,
    details: { commands: JSON.stringify(rollbackCommands), results: JSON.stringify(results.map((r: { command: string; success: boolean; output: string }) => ({ success: r.success }))) },
  });

  return {
    status: allSuccess ? 'success' : 'failed',
    output,
    metadata: { results, allSuccess, commandCount: rollbackCommands.length },
  };
}

function extractRollbackCommands(
  config: RollbackNodeConfig,
  nodeResults: Record<string, NodeResult>
): string[] {
  // 从指定节点输出中提取回滚命令
  if (config.commandSourceNodeId) {
    const nodeResult = nodeResults[config.commandSourceNodeId];
    if (nodeResult?.metadata?.rollbackCommands) {
      return nodeResult.metadata.rollbackCommands as string[];
    }
    if (nodeResult?.output) {
      // 尝试从输出中提取 ```bash ... ``` 代码块
      const match = nodeResult.output.match(/```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/);
      if (match) {
        return match[1].split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('#'));
      }
    }
  }

  // 从所有节点结果中搜索回滚相关内容
  for (const result of Object.values(nodeResults)) {
    if (result.metadata?.rollbackCommands) {
      return result.metadata.rollbackCommands as string[];
    }
    if (result.output?.includes('回滚') || result.output?.includes('rollback')) {
      const match = result.output.match(/```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/);
      if (match) {
        return match[1].split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('#'));
      }
    }
  }

  return [];
}
