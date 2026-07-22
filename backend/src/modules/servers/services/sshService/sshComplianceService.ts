import { randomUUID } from 'crypto';
import { serversRepo } from '../../../../repositories/serverRepository';
import { generateCompletion } from '../../../ai/services/llm/llmService';
import { logger } from '../../../../utils/logger';
import type { OSType } from '../../../scripts/services/commandDispatcher';
import { getCommandTemplates } from '../../../scripts/services/commandDispatcher';
import { executeCommand } from './sshCommandExecutor';
import type { CommandResult } from './sshTypes';

// 根据操作系统类型获取合规检查列表
function getComplianceCheckList(osType: OSType) {
  const templates = getCommandTemplates(osType);
  const baseList = [
    { name: 'CPU Usage', command: templates.compliance.cpu },
    { name: 'Memory Usage', command: templates.compliance.memory },
    { name: 'Disk Usage', command: templates.compliance.disk },
    { name: 'Network Info', command: templates.compliance.network },
    { name: 'User List', command: templates.compliance.users },
    { name: 'Running Services', command: templates.compliance.services },
    { name: 'Uptime', command: templates.compliance.uptime },
    { name: 'OS Info', command: templates.compliance.os_info }
  ];

  // Windows 和 Linux 特有的检查
  if (osType === 'windows') {
    return baseList;
  }

  // Linux 特有的检查
  return [
    ...baseList,
    { name: 'SSH Config', command: 'cat /etc/ssh/sshd_config 2>/dev/null || echo "No SSH config found"' },
    { name: 'Firewall Status', command: 'iptables -L -n 2>/dev/null || ufw status 2>/dev/null || echo "No firewall info"' },
    { name: 'Last Logins', command: 'last -20' },
    { name: 'Cron Jobs', command: 'crontab -l 2>/dev/null || echo "No cron jobs" && ls -la /etc/cron.* 2>/dev/null' },
    { name: 'Package Updates', command: 'apt list --upgradable 2>/dev/null | head -30 || yum check-update 2>/dev/null | head -30 || echo "No package manager found"' }
  ];
}

// 导出默认 Linux 版本以保持向后兼容
const complianceCheckList = getComplianceCheckList('linux');
export { complianceCheckList as complianceChecks };

// 批量 AI 分析合规检查结果
async function analyzeAllComplianceChecks(results: Record<string, CommandResult>): Promise<Record<string, string>> {
  const startTime = Date.now();
  const analysisResults: Record<string, string> = {};

  try {
    logger.info(`🤖 [Compliance AI] 开始批量分析 ${Object.keys(results).length} 个检查项`);

    // 构建批量分析的 prompt
    let prompt = '作为一个专业的服务器运维专家，请分析以下合规检查结果，并为每个检查项给出专业的评估和建议。\n\n';

    let index = 1;
    for (const [checkName, result] of Object.entries(results)) {
      prompt += `【检查项 ${index}: ${checkName}】\n`;
      prompt += `执行状态：${result.success ? '成功' : '失败'}\n`;
      prompt += `执行命令：${result.command}\n`;
      prompt += `输出摘要：\n${result.stdout.substring(0, 500)}\n\n`;
      index++;
    }

    prompt += `请为每个检查项分别进行分析，格式如下：
---检查项名称: [检查项名称]---
分析：[你的分析，简洁专业]
风险等级：[低/中/高]
建议：[具体改进建议]

请使用中文回答，每个检查项的分析控制在 150 字以内。`;

    const systemPrompt = '你是一个专业的服务器运维安全专家，擅长分析系统合规检查结果，识别安全风险并提供改进建议。你的回答要简洁、专业、有针对性。';

    const aiResponse = await generateCompletion(prompt, systemPrompt, 0.6, undefined, 'compliance-batch');

    // 解析 AI 返回的批量分析结果
    const analysisPattern = /---检查项名称:\s*(.+?)---/g;
    const sections = aiResponse.split(analysisPattern);

    let checkIndex = 0;
    const checkNames = Object.keys(results);

    for (let i = 1; i < sections.length; i += 2) {
      const name = sections[i]?.trim() || checkNames[checkIndex] || `未知检查项${checkIndex}`;
      const content = sections[i + 1]?.trim() || aiResponse;

      // 尝试匹配最接近的检查项名称
      const matchedName = checkNames.find(n =>
        name.includes(n) || n.includes(name)
      ) || checkNames[checkIndex] || name;

      analysisResults[matchedName] = content;
      checkIndex++;
    }

    // 如果解析失败，为每个检查项使用相同的通用分析
    if (Object.keys(analysisResults).length === 0) {
      logger.warn(`🤖 [Compliance AI] 批量解析失败，使用统一分析结果`);
      for (const name of checkNames) {
        analysisResults[name] = aiResponse;
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`🤖 [Compliance AI] 批量分析完成，耗时: ${duration}ms，分析了 ${Object.keys(analysisResults).length} 个检查项`);

    return analysisResults;
  } catch (error) {
    logger.error(`❌ [Compliance AI] 批量分析失败`, error instanceof Error ? error : new Error(String(error)));
    // 失败时返回统一的提示
    const fallbackAnalysis = 'AI 分析暂不可用，请查看原始输出。';
    for (const name of Object.keys(results)) {
      analysisResults[name] = fallbackAnalysis;
    }
    return analysisResults;
  }
}

export async function runComplianceCheck(
  serverId: string,
  options: {
    saveResults?: boolean;
    useAI?: boolean;
    concurrency?: number;
  } = {}
): Promise<Record<string, CommandResult>> {
  const totalStartTime = Date.now();
  const checkId = randomUUID();
  const results: Record<string, CommandResult> = {};
  const useAI = options.useAI !== false;
  const concurrency = options.concurrency ?? 5;

  logger.info(`🚀 [Compliance Check] 开始合规检查，服务器: ${serverId}，并发数: ${concurrency}，AI分析: ${useAI}`);

  // 获取服务器的 os_type
  const server = serversRepo.getById(serverId);
  const osType = (server?.os_type || 'linux') as OSType;

  // 获取对应操作系统的合规检查列表
  const checks = getComplianceCheckList(osType);
  logger.info(`📋 [Compliance Check] 检查项数量: ${checks.length}，操作系统: ${osType}`);

  if (options.saveResults) {
    serversRepo.insertComplianceCheck({
      id: checkId,
      server_id: serverId,
      check_name: 'Full Compliance Check',
      check_results: '[]',
      status: 'running',
      started_at: "datetime('now','localtime')",
    });
  }

  // 第一步：并发执行所有 SSH 命令，不进行 AI 分析
  const commandStartTime = Date.now();

  const executeCheckOnly = async (check: typeof checks[0]): Promise<[string, CommandResult]> => {
    const result = await executeCommand(serverId, check.command, {
      logHistory: false,
      executedBy: 'compliance-check'
    });
    return [check.name, result];
  };

  for (let i = 0; i < checks.length; i += concurrency) {
    const batch = checks.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(executeCheckOnly));
    batchResults.forEach(([name, result]) => {
      results[name] = result;
    });
    logger.info(`✅ [Compliance Check] 完成批次 ${Math.floor(i / concurrency) + 1}/${Math.ceil(checks.length / concurrency)}，已完成 ${Object.keys(results).length}/${checks.length}`);
  }

  const commandDuration = Date.now() - commandStartTime;
  logger.info(`⚡ [Compliance Check] 所有命令执行完成，耗时: ${commandDuration}ms`);

  // 第二步：批量 AI 分析（一次 LLM 调用）
  if (useAI) {
    const aiStartTime = Date.now();
    const analysisResults = await analyzeAllComplianceChecks(results);

    // 将分析结果分配到每个检查项
    for (const [name, analysis] of Object.entries(analysisResults)) {
      if (results[name]) {
        results[name].aiAnalysis = analysis;
      }
    }

    const aiDuration = Date.now() - aiStartTime;
    logger.info(`🤖 [Compliance Check] AI 分析完成，耗时: ${aiDuration}ms`);
  }

  if (options.saveResults) {
    serversRepo.updateComplianceCheck(checkId, JSON.stringify(results));
  }

  const totalDuration = Date.now() - totalStartTime;
  logger.info(`🏁 [Compliance Check] 全部完成，总耗时: ${totalDuration}ms，命令执行: ${commandDuration}ms，AI分析: ${useAI ? `${totalDuration - commandDuration}ms` : '跳过'}`);

  return results;
}