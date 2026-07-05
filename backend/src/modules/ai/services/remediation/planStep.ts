/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * AI 修复服务 - 计划步骤：生成修复工作流定义
 * =============================================================================
 */

import { randomUUID } from 'crypto';
import type { WorkflowNode, WorkflowEdge, WorkflowParsed } from '../../../../types';
import type { AiRemediationInput } from './aiRemediationService';
import { impl_generateVerificationPrompt, impl_generateRollbackPrompt } from './analysisStep';

/**
 * 生成修复工作流
 * 结构：[审批节点] → [执行修复 Agent 节点] → [验证结果 Agent 节点]
 *       [回滚节点]（断开连接，验证失败时由 finalizeWorkflow 自动触发）
 */
export function impl_generateRemediationWorkflow(
  input: AiRemediationInput,
  _remediationId: string
): { workflow: any; workflowParsed: WorkflowParsed } {
  const approvalNodeId = randomUUID();
  const executionNodeId = randomUUID();
  const verificationNodeId = randomUUID();
  const rollbackNodeId = randomUUID();

  // 审批节点配置
  const timeoutSeconds = input.riskLevel === 'high' ? 7200 : input.riskLevel === 'medium' ? 3600 : 1800;

  // 构建修复命令的 prompt
  const commandsText = input.remediationCommands.map((cmd, i) => `${i + 1}. ${cmd}`).join('\n');
  const executionPrompt = `你是一个运维执行专家。请在设备 ${input.deviceName}(${input.deviceIp}) 上执行以下修复命令：

${commandsText}

执行要求：
1. 按顺序执行每个命令
2. 每个命令执行后检查返回码
3. 如果命令失败，记录错误信息但继续执行后续命令
4. 最后汇总执行结果

告警信息：
- 告警标题: ${input.alertTitle}
- 告警级别: ${input.alertSeverity}
- 风险等级: ${input.riskLevel}

AI 诊断结果：
${input.diagnosis.substring(0, 1000)}

请开始执行修复命令。`;

  // 验证节点 prompt：根据修复命令生成对应的验证逻辑
  const verificationPrompt = impl_generateVerificationPrompt(input, commandsText);

  // 回滚节点 prompt：生成修复命令的逆向操作
  const rollbackPrompt = impl_generateRollbackPrompt(input, commandsText);

  // 节点定义
  const nodes: WorkflowNode[] = [
    {
      id: approvalNodeId,
      type: 'approval',
      position: { x: 100, y: 200 },
      data: {
        label: `审批修复方案 (${input.riskLevel.toUpperCase()} 风险)`,
        description: `AI 建议对 ${input.deviceName}(${input.deviceIp}) 执行修复操作，共 ${input.remediationCommands.length} 条命令`,
        approvalConfig: {
          description: `修复方案:\n${commandsText}\n\n风险等级: ${input.riskLevel}\n目标设备: ${input.deviceName}(${input.deviceIp})`,
          timeout: timeoutSeconds,
          timeoutAction: 'reject' as const,
          approvers: ['admin'],
        },
      },
    },
    {
      id: executionNodeId,
      type: 'agent',
      position: { x: 400, y: 200 },
      data: {
        label: '执行修复命令',
        agentId: 'server-command-agent',
        avatar: '🔧',
        description: '在目标设备上执行 AI 建议的修复命令',
        prompt: executionPrompt,
        inputKey: 'approval_result',
        outputKey: 'execution_result',
      },
    },
    {
      id: verificationNodeId,
      type: 'agent',
      position: { x: 700, y: 200 },
      data: {
        label: '验证修复结果',
        agentId: 'server-command-agent',
        avatar: '✅',
        description: '验证修复命令是否成功执行，检查系统状态是否恢复正常',
        prompt: verificationPrompt,
        inputKey: 'execution_result',
        outputKey: 'verification_result',
      },
    },
    {
      id: rollbackNodeId,
      type: 'agent',
      position: { x: 700, y: 400 },
      data: {
        label: '自动回滚',
        agentId: 'server-command-agent',
        avatar: '↩️',
        description: '验证失败时自动执行回滚操作，恢复系统到修复前状态',
        prompt: rollbackPrompt,
        inputKey: 'verification_result',
        outputKey: 'rollback_result',
      },
    },
  ];

  // 边定义：审批 → 执行 → 验证
  // 回滚节点断开连接，由 finalizeWorkflow 在验证失败时自动触发
  const edges: WorkflowEdge[] = [
    {
      id: `edge-${approvalNodeId}-${executionNodeId}`,
      source: approvalNodeId,
      target: executionNodeId,
      animated: true,
    },
    {
      id: `edge-${executionNodeId}-${verificationNodeId}`,
      source: executionNodeId,
      target: verificationNodeId,
      animated: true,
    },
  ];

  const workflow = {
    id: randomUUID(),
    name: `AI 修复工作流: ${input.alertTitle}`,
    description: `AI 自动生成的修复工作流，针对告警: ${input.alertTitle}`,
    nodes: JSON.stringify(nodes),
    edges: JSON.stringify(edges),
    agent_configs: JSON.stringify({}),
    is_template: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const workflowParsed: WorkflowParsed = {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    nodes,
    edges,
    agent_configs: {},
    is_template: 0,
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };

  return { workflow, workflowParsed };
}