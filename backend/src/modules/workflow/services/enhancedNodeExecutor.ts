/**
 * Phase 1: 增强节点执行器
 * 将 AARS 的 verification/risk_assess/decision/knowledge/rollback 能力
 * 移植为工作流标准节点执行逻辑
 */

import { serversRepo, settingsRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { createAuditLog } from '../../infra/services/auditService';
import { executeCommand } from '../../servers/services/sshService';
import { knowledgeEngine } from '../../ai/services/KnowledgeEngine';
import type { NodeResult, ExecutionContext } from '../../../types';
import type {
  VerificationNodeConfig,
  VerificationStage,
  RiskAssessNodeConfig,
  RiskAssessmentResult,
  DecisionNodeConfig,
  DecisionAction,
  DecisionRule,
  KnowledgeNodeConfig,
  RollbackNodeConfig,
} from './enhancedNodeTypes';
import { getErrorMessage } from '../../../utils/errorHelpers';

// ─────────────────────────────────────────────
// 1. verification 节点：5级验证门禁链
// ─────────────────────────────────────────────

interface GateStage {
  stage: VerificationStage;
  required: boolean;
  maxRetries: number;
  retryIntervalSec: number;
  timeoutSec: number;
}

const DEFAULT_GATES: GateStage[] = [
  { stage: 'command_success', required: true, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
  { stage: 'service_health', required: true, maxRetries: 3, retryIntervalSec: 10, timeoutSec: 60 },
  { stage: 'metric_recovery', required: true, maxRetries: 2, retryIntervalSec: 30, timeoutSec: 120 },
  { stage: 'baseline_comparison', required: false, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
  { stage: 'impact_assessment', required: true, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 },
];

export async function executeVerificationNode(
  config: VerificationNodeConfig,
  serverId?: string,
): Promise<NodeResult> {
  const stages = buildGateStages(config);
  const stageResults: Array<{ stage: VerificationStage; passed: boolean; skipped: boolean; detail: string }> = [];
  let failedStage: VerificationStage | null = null;

  for (const gate of stages) {
    let passed = false;
    let detail = '';

    for (let attempt = 0; attempt <= gate.maxRetries; attempt++) {
      if (attempt > 0) {
        await delay(gate.retryIntervalSec * 1000);
      }

      try {
        const result = await runGateCheck(gate.stage, serverId);
        passed = result.passed;
        detail = result.detail;
        if (passed) break;
      } catch (err: unknown) {
        detail = `检查异常: ${getErrorMessage(err) || String(err)}`;
        logger.warn(`verification gate ${gate.stage} attempt ${attempt + 1}/${gate.maxRetries + 1}: ${detail}`);
      }
    }

    if (!passed && gate.required) {
      stageResults.push({ stage: gate.stage, passed: false, skipped: false, detail });
      failedStage = gate.stage;
      break; // 必须门禁失败，终止后续检查
    }

    stageResults.push({ stage: gate.stage, passed, skipped: !gate.required && !passed, detail });
    if (!passed) continue;
  }

  const overallResult = failedStage ? 'failed'
    : stageResults.some(s => !s.passed && !s.skipped) ? 'partially_passed_with_warning'
    : 'passed';

  const output = formatVerificationOutput(overallResult, stageResults, failedStage);

  return {
    status: overallResult === 'failed' ? 'failed' : 'success',
    output,
    metadata: {
      overallResult,
      stages: stageResults,
      failedStage,
    },
  };
}

function buildGateStages(config: VerificationNodeConfig): GateStage[] {
  if (!config.gates || config.gates.length === 0) return [...DEFAULT_GATES];
  return config.gates.map((stage: string) => {
    const base = DEFAULT_GATES.find((g: GateStage) => g.stage === stage) || { stage: stage as VerificationStage, required: true, maxRetries: 0, retryIntervalSec: 0, timeoutSec: 30 };
    const overrides = config.stageOverrides?.[stage as VerificationStage] || {};
    return { ...base, ...overrides };
  });
}

async function runGateCheck(stage: VerificationStage, serverId?: string): Promise<{ passed: boolean; detail: string }> {
  if (!serverId) {
    return { passed: false, detail: '未指定服务器，无法执行验证' };
  }

  const server = serversRepo.getById(serverId) as { id: string; hostname: string; port: number; username: string; use_ssh_key: number; private_key?: string; password?: string } | undefined;
  if (!server) {
    return { passed: false, detail: `服务器 ${serverId} 不存在` };
  }

  try {
    switch (stage) {
      case 'command_success':
        return { passed: true, detail: '命令已执行（由前置节点保证）' };

      case 'service_health':
        return await checkServiceHealth(server);
      case 'metric_recovery':
        return await checkMetricRecovery(server);
      case 'baseline_comparison':
        return await checkBaselineComparison(server);
      case 'impact_assessment':
        return await checkImpactAssessment(server);
      default:
        return { passed: true, detail: '未知验证阶段，默认通过' };
    }
  } catch (err: unknown) {
    return { passed: false, detail: `SSH 执行失败: ${getErrorMessage(err) || String(err)}` };
  }
}

async function checkServiceHealth(server: { id: string; hostname: string; port: number; username: string; use_ssh_key: number; private_key?: string; password?: string }): Promise<{ passed: boolean; detail: string }> {
  try {
    // 检查系统关键服务：sshd, cron, rsyslog/systemd-journald
    const result = await executeCommand(
      server.id as string,
      'systemctl is-active sshd 2>/dev/null; systemctl is-active cron 2>/dev/null || systemctl is-active crond 2>/dev/null; echo "---UP---"',
      { timeout: 15000 }
    );
    const output = result.stdout || '';
    const failedServices = output.split('\n')
      .filter((line: string) => line && line !== '---UP---' && line.trim() !== 'active' && line.trim() !== 'inactive')
      .filter(Boolean);

    if (failedServices.length === 0) {
      return { passed: true, detail: '关键服务运行正常' };
    }
    return { passed: false, detail: `服务异常: ${failedServices.join(', ')}` };
  } catch {
    return { passed: false, detail: '无法检查服务状态' };
  }
}

async function checkMetricRecovery(server: { id: string; hostname: string; port: number; username: string; use_ssh_key: number; private_key?: string; password?: string }): Promise<{ passed: boolean; detail: string }> {
  try {
    const result = await executeCommand(
      server.id as string,
      'echo "LOAD:$(cat /proc/loadavg | awk \'{print $1}\')" && echo "MEM:$(free -m | awk \'/^Mem:/{printf "%.0f", $3/$2*100}\')" && echo "DISK:$(df -h / | awk \'NR==2{print $5}\' | tr -d \'%\')"',
      { timeout: 10000 }
    );
    const output = result.stdout || '';

    const loadMatch = output.match(/LOAD:([\d.]+)/);
    const memMatch = output.match(/MEM:(\d+)/);
    const diskMatch = output.match(/DISK:(\d+)/);

    const load = loadMatch ? parseFloat(loadMatch[1]) : 0;
    const mem = memMatch ? parseInt(memMatch[1]) : 0;
    const disk = diskMatch ? parseInt(diskMatch[1]) : 0;

    const issues: string[] = [];
    if (load > 5) issues.push(`CPU负载偏高: ${load}`);
    if (mem > 90) issues.push(`内存使用率偏高: ${mem}%`);
    if (disk > 90) issues.push(`磁盘使用率偏高: ${disk}%`);

    if (issues.length === 0) {
      return { passed: true, detail: `指标正常 (负载:${load}, 内存:${mem}%, 磁盘:${disk}%)` };
    }
    return { passed: false, detail: issues.join('; ') };
  } catch {
    return { passed: false, detail: '无法检查系统指标' };
  }
}

async function checkBaselineComparison(server: { id: string; hostname: string; port: number; username: string; use_ssh_key: number; private_key?: string; password?: string }): Promise<{ passed: boolean; detail: string }> {
  try {
    // 简单基线对比：获取当前负载和最近一次记录的负载
    const result = await executeCommand(
      server.id as string,
      'cat /proc/loadavg 2>/dev/null',
      { timeout: 5000 }
    );
    const output = (result.stdout || '').trim();
    const currentLoad = output ? parseFloat(output.split(/\s+/)[0]) : 0;

    // 从数据库获取上次基线
    const lastBaselineValue = settingsRepository.getValue(`aars_baseline:${server.id}:last_loadavg`);

    const baselineValue = lastBaselineValue ? parseFloat(lastBaselineValue) : currentLoad;
    const threshold = baselineValue * 1.5; // 基线 +50%

    if (currentLoad <= threshold) {
      return { passed: true, detail: `当前负载 ${currentLoad} 在基线范围 (基线: ${baselineValue}, 阈值: ${threshold.toFixed(1)})` };
    }
    return { passed: false, detail: `当前负载 ${currentLoad} 超过基线 ${threshold.toFixed(1)}` };
  } catch {
    return { passed: false, detail: '基线对比失败' };
  }
}

async function checkImpactAssessment(server: { id: string; hostname: string; port: number; username: string; use_ssh_key: number; private_key?: string; password?: string }): Promise<{ passed: boolean; detail: string }> {
  try {
    // 检查关键进程和端口是否正常
    const result = await executeCommand(
      server.id as string,
      'ps aux --no-headers | wc -l && echo "---" && ss -tlnp 2>/dev/null | wc -l',
      { timeout: 10000 }
    );
    const output = result.stdout || '';
    const parts = output.split('---');

    const processCount = parseInt(parts[0]?.trim() || '0');
    const portCount = parseInt(parts[1]?.trim() || '0');

    if (processCount > 10 && portCount > 0) {
      return { passed: true, detail: `系统运行正常 (进程数:${processCount}, 监听端口:${portCount})` };
    }
    return { passed: false, detail: `系统可能异常 (进程数:${processCount}, 监听端口:${portCount})` };
  } catch {
    return { passed: false, detail: '影响评估检查失败' };
  }
}

function formatVerificationOutput(
  overall: string,
  stages: Array<{ stage: VerificationStage; passed: boolean; skipped: boolean; detail: string }>,
  failedStage: VerificationStage | null
): string {
  const statusIcons: Record<string, string> = { 'passed': '✅', 'failed': '❌', 'partially_passed_with_warning': '⚠️' };
  const icon = statusIcons[overall] || '❓';

  let output = `## ${icon} 验证结果: ${overall === 'passed' ? '全部通过' : overall === 'failed' ? '验证失败' : '部分通过(有警告)'}\n\n`;
  output += '| 阶段 | 结果 | 详情 |\n|------|------|------|\n';

  for (const s of stages) {
    const resultIcon = s.passed ? '✅' : s.skipped ? '⏭️' : '❌';
    const stageNames: Record<string, string> = {
      command_success: '命令执行', service_health: '服务健康',
      metric_recovery: '指标恢复', baseline_comparison: '基线对比', impact_assessment: '影响评估',
    };
    output += `| ${stageNames[s.stage] || s.stage} | ${resultIcon} | ${s.detail} |\n`;
  }

  if (failedStage) {
    output += `\n> ❌ 门禁 **${failedStage}** 未通过，验证中止`;
  }

  return output;
}

// ─────────────────────────────────────────────
// 2. risk_assess 节点：三维风险量化评分
// ─────────────────────────────────────────────

export function executeRiskAssessNode(
  config: RiskAssessNodeConfig,
  executionContext: ExecutionContext,
  previousResults: string[]
): NodeResult {
  const severity = config.alertSeverity || 'medium';
  const _title = config.alertTitle || '未知告警';

  // 从上下文或变量中提取修复计划信息
  const planOutput = config.planSourceNodeId
    ? previousResults.find((r: string) => r.includes('修复') || r.includes('命令')) || previousResults[previousResults.length - 1] || ''
    : previousResults.join('\n').substring(0, 2000);

  // 分析命令风险因子
  const hasServiceRestart = /restart|reload|systemctl\s+restart/i.test(planOutput);
  const hasReboot = /reboot|shutdown/i.test(planOutput);
  const hasConfigModify = /sed\s+-i|echo\s+.*>\s*\/etc|chmod|chown|sysctl/i.test(planOutput);
  const hasDataDelete = /rm\s+-rf|delete|drop\s+table|truncate/i.test(planOutput);
  const mayCauseDowntime = /stop|kill|pkill|killall/i.test(planOutput);
  const isReadonly = !hasServiceRestart && !hasReboot && !hasConfigModify && !hasDataDelete && !mayCauseDowntime;
  const hasRollback = /回滚|rollback|revert|undo/i.test(planOutput);

  // 操作风险评估
  const factors: Record<string, { triggered: boolean; weight: number }> = {
    isReadonly: { triggered: isReadonly, weight: 0 },
    requiresServiceRestart: { triggered: hasServiceRestart, weight: 0.25 },
    requiresMachineReboot: { triggered: hasReboot, weight: 0.35 },
    modifiesConfig: { triggered: hasConfigModify, weight: 0.20 },
    deletesData: { triggered: hasDataDelete, weight: 0.40 },
    mayCauseDowntime: { triggered: mayCauseDowntime, weight: 0.30 },
  };

  let operationalRiskScore = Object.values(factors)
    .filter((f: { triggered: boolean; weight: number }) => f.triggered)
    .reduce((sum: number, f: { triggered: boolean; weight: number }) => sum + f.weight, 0);

  const highRiskCount = Object.values(factors).filter((f: { triggered: boolean; weight: number }) => f.triggered && f.weight >= 0.25).length;
  if (highRiskCount >= 2) operationalRiskScore = Math.min(1.0, operationalRiskScore + 0.2);

  // 时间紧迫度评估
  const severityMap: Record<string, number> = {
    disaster: 1.0, critical: 0.9, high: 0.7, warning: 0.4,
    medium: 0.3, average: 0.3, info: 0.1, low: 0.1,
  };
  const severityScore = severityMap[severity.toLowerCase()] || 0.3;
  const hour = new Date().getHours();
  const isOffHours = hour < 8 || hour > 20 || [0, 6].includes(new Date().getDay());
  const urgencyScore = Math.min(1.0, severityScore * 0.6 + (isOffHours ? 0.2 : 0));

  // AI 置信度评估
  let confidenceScore = 0.5;
  if (hasRollback) confidenceScore += 0.15;
  if (planOutput.length > 200) confidenceScore += 0.1;
  if ((planOutput.match(/&&|;/g) || []).length > 2) confidenceScore += 0.1;
  if (isReadonly) confidenceScore += 0.15;
  confidenceScore = Math.min(1.0, confidenceScore);

  // 综合风险分数
  const overallRiskScore = operationalRiskScore * 0.5 + (1 - urgencyScore) * 0.2 + (1 - confidenceScore) * 0.3;

  // 动态阈值
  const thresholds = {
    auto: config.thresholds?.auto ?? (confidenceScore > 0.85 ? 0.45 : confidenceScore > 0.7 ? 0.35 : 0.25),
    approve: config.thresholds?.approve ?? (confidenceScore > 0.85 ? 0.75 : confidenceScore > 0.7 ? 0.65 : 0.55),
    manual: config.thresholds?.manual ?? 0.85,
  };

  // 确定建议动作
  let suggestedAction: RiskAssessmentResult['suggestedAction'];
  if (overallRiskScore <= thresholds.auto) suggestedAction = 'auto_execute';
  else if (overallRiskScore <= thresholds.approve) suggestedAction = 'require_approval';
  else if (overallRiskScore <= thresholds.manual) suggestedAction = 'manual_only';
  else suggestedAction = 'escalate';

  // 风险级别
  let riskLevel: RiskAssessmentResult['riskLevel'];
  if (overallRiskScore < 0.25) riskLevel = 'low';
  else if (overallRiskScore < 0.55) riskLevel = 'medium';
  else if (overallRiskScore < 0.80) riskLevel = 'high';
  else riskLevel = 'critical';

  const dimensions = {
    operationalRisk: { score: operationalRiskScore, factors },
    urgencyScore,
    confidenceScore,
  };

  const detail = `操作风险:${(operationalRiskScore * 100).toFixed(0)}% | 紧迫度:${(urgencyScore * 100).toFixed(0)}% | 置信度:${(confidenceScore * 100).toFixed(0)}%`;

  const output = `## 🔍 风险评估结果\n\n` +
    `| 维度 | 分数 |\n|------|------|\n` +
    `| 操作风险 | ${(operationalRiskScore * 100).toFixed(0)}% |\n` +
    `| 时间紧迫度 | ${(urgencyScore * 100).toFixed(0)}% |\n` +
    `| AI 置信度 | ${(confidenceScore * 100).toFixed(0)}% |\n` +
    `| **综合风险** | **${(overallRiskScore * 100).toFixed(0)}%** |\n\n` +
    `- **风险级别**: ${riskLevel}\n` +
    `- **建议动作**: ${suggestedAction}\n` +
    `- **详情**: ${detail}`;

  return {
    status: 'success',
    output,
    metadata: { overallRiskScore, dimensions, riskLevel, suggestedAction, thresholds, detail },
  };
}

// ─────────────────────────────────────────────
// 3. decision 节点：自适应决策引擎
// ─────────────────────────────────────────────

export function executeDecisionNode(
  config: DecisionNodeConfig,
  nodeResults: Record<string, NodeResult>
): { action: DecisionAction; reason: string; output: string } {
  // 从风险评估节点获取数据
  let riskScore = 0.5;
  let riskLevel = 'medium';

  if (config.riskSourceNodeId && nodeResults[config.riskSourceNodeId]?.metadata) {
    const meta = nodeResults[config.riskSourceNodeId].metadata as Record<string, string | number | boolean> || {};
    riskScore = (meta.overallRiskScore as number) || 0.5;
    riskLevel = (meta.riskLevel as string) || 'medium';
  }

  // 逐个匹配规则
  for (const rule of config.rules || []) {
    const matched = evaluateRule(rule, riskScore, riskLevel);
    if (matched) {
      return {
        action: rule.action,
        reason: rule.description || `匹配规则: ${rule.condition}`,
        output: `## 🎯 决策结果\n\n` +
          `- **动作**: ${rule.action}\n` +
          `- **原因**: ${rule.description || rule.condition}\n` +
          `- **风险分数**: ${(riskScore * 100).toFixed(0)}% | ${riskLevel}`,
      };
    }
  }

  // 默认动作
  const defaultAction = config.defaultAction || 'request_approval';
  return {
    action: defaultAction,
    reason: '未命中任何规则，使用默认动作',
    output: `## 🎯 决策结果\n\n` +
      `- **动作**: ${defaultAction}\n` +
      `- **原因**: 默认策略\n` +
      `- **风险分数**: ${(riskScore * 100).toFixed(0)}% | ${riskLevel}`,
  };
}

function evaluateRule(rule: DecisionRule, riskScore: number, riskLevel: string): boolean {
  try {
    // 简单的条件解析器
    const condition = rule.condition.replace(/\s+/g, ' ').trim();

    // risk_score < N
    const riskScoreMatch = condition.match(/risk_score\s*(<|<=|>|>=|==)\s*([\d.]+)/);
    if (riskScoreMatch) {
      const op = riskScoreMatch[1];
      const val = parseFloat(riskScoreMatch[2]);
      switch (op) {
        case '<': return riskScore < val;
        case '<=': return riskScore <= val;
        case '>': return riskScore > val;
        case '>=': return riskScore >= val;
        case '==': return Math.abs(riskScore - val) < 0.01;
      }
    }

    // risk_level == 'xxx'
    const levelMatch = condition.match(/risk_level\s*==\s*['"](\w+)['"]/);
    if (levelMatch) {
      return riskLevel === levelMatch[1];
    }

    // 复合条件：A && B 或 A || B
    if (condition.includes('&&')) {
      return condition.split('&&').every((part: string) => evaluateRule({ ...rule, condition: part.trim() }, riskScore, riskLevel));
    }
    if (condition.includes('||')) {
      return condition.split('||').some((part: string) => evaluateRule({ ...rule, condition: part.trim() }, riskScore, riskLevel));
    }

    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// 4. knowledge 节点：知识沉淀闭环
// ─────────────────────────────────────────────

export function executeKnowledgeNode(
  config: KnowledgeNodeConfig,
  workflowName: string,
  taskId: string,
  workflowId: string,
  nodeResults: Record<string, NodeResult>,
  overallSuccess: boolean,
): NodeResult {
  // 使用统一知识引擎
  const knowledgeId = knowledgeEngine.storeFromWorkflow({
    workflowName,
    taskId,
    workflowId,
    nodeResults,
    overallSuccess,
  });

  return {
    status: 'success',
    output: `📚 知识已沉淀: "${workflowName}" (${knowledgeId})`,
    metadata: { knowledgeId, category: 'workflow_execution' },
  };
}

// ─────────────────────────────────────────────
// 5. rollback 节点：自动回滚
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
