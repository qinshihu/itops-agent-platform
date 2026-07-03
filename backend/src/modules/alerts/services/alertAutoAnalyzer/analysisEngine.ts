/**
 * 分析引擎：SSH 诊断执行 + AI 分析 + 告警分析编排
 */

import { Client } from 'ssh2';
import crypto from 'crypto';
import { alertRepository, knowledgeRepository, networkDeviceRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { generateCompletion } from '../../../ai/services/llm/llmService';
import { remediationService } from '../../../auto/services/remediationService';
import { isAlreadyProcessedByAARS } from './alertFetcher';
import {
  type DeviceInfo,
  findDeviceByAlert,
  getDiagnosticCmds,
  getAlertSpecificCmds,
  getSnmpInspectionData,
} from './deviceResolver';
import { type AutoAnalysisResult, saveRecord } from './resultWriter';
import { getErrorMessage } from '../../../../utils/errorHelpers';

// ====================== SSH 执行 ======================

/** 通过 SSH 执行一条命令，返回 stdout */
export function sshExec(device: DeviceInfo, command: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    conn.on('ready', () => {
      conn.exec(command, { pty: { term: 'vt100', cols: 200, rows: 50 } }, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('data', (data: Buffer) => { output += data.toString('utf8'); });
        stream.stderr.on('data', (data: Buffer) => { output += data.toString('utf8'); });
        stream.on('close', () => { conn.end(); resolve(output); });
      });
    });
    conn.on('error', (err) => { reject(err); });
    conn.connect({
      host: device.ip_address,
      port: device.ssh_port || 22,
      username: device.username || 'root',
      password: device.password,
      readyTimeout: timeoutMs,
    });
  });
}

/** 执行 SSH 诊断 */
export async function runSshDiagnosis(device: DeviceInfo, alertTitle: string): Promise<{
  rawOutput: string;
  commands: string[];
}> {
  // 获取设备厂商（仅 network_devices 有 vendor 字段）
  let vendor: string | undefined;
  if (device.device_type === 'network_device') {
    vendor = networkDeviceRepository.getVendor(device.id);
  }

  const cmds = getDiagnosticCmds(device.device_type, vendor);
  const outputParts: string[] = [];
  const executedCmds: string[] = [];

  for (const cmd of cmds) {
    try {
      const output = await sshExec(device, cmd);
      executedCmds.push(cmd);
      outputParts.push(`## ${cmd}\n\`\`\`\n${output.trim() || '(no output)'}\n\`\`\``);
    } catch (err: unknown) {
      outputParts.push(`## ${cmd}\n\`\`\`\n[ERROR] ${getErrorMessage(err)}\n\`\`\``);
    }
  }

  // 针对告警标题的额外诊断
  const alertRelatedCmds = getAlertSpecificCmds(alertTitle, device.device_type);
  for (const cmd of alertRelatedCmds) {
    try {
      const output = await sshExec(device, cmd);
      executedCmds.push(cmd);
      outputParts.push(`## ${cmd}\n\`\`\`\n${output.trim() || '(no output)'}\n\`\`\``);
    } catch {
      // 可选命令，失败可忽略
    }
  }

  return {
    rawOutput: outputParts.join('\n\n'),
    commands: executedCmds,
  };
}

// ====================== AI 分析 ======================

/** AI 分析诊断输出 */
export async function aiAnalyze(alertTitle: string, alertContent: string, rawOutput: string): Promise<{ diagnosis: string; summary: string; remediationCommands?: string[]; riskLevel?: 'low' | 'medium' | 'high' }> {
  // ── 查知识库获取相关历史方案 ──
  let knowledgeContext = '';
  try {
    const keywords = alertTitle.split(/[\s,_-]+/).filter(Boolean).slice(0, 3).join(' ');
    const kbEntries = knowledgeRepository.searchForAnalysis(keywords, 3);
    if (kbEntries.length > 0) {
      knowledgeContext = '\n\n## 历史知识库参考\n' + kbEntries.map((e, i) =>
        `[${i + 1}] ${e.title}\n   方案: ${(() => { try { return JSON.parse(e.solutions).join('; '); } catch { return e.content?.substring(0, 200) || ''; } })()}`
      ).join('\n');
    }
  } catch { /* 知识库表可能不存在 */ }

  const systemPrompt = `你是一个网络运维专家。根据告警信息和设备诊断输出，判断根因并给出修复建议。
你需要返回两部分内容：
1. 诊断报告（自然语言）
2. 修复命令（JSON 格式，可执行）

输出格式要求：
- 第一行：摘要（50字内）
- 然后：详细诊断报告
- 最后：一个 JSON 代码块，包含修复命令

JSON 格式示例：
\`\`\`json
{
  "remediation_commands": [
    "systemctl restart nginx",
    "journalctl -u nginx --no-pager -n 50"
  ],
  "risk_level": "medium",
  "description": "重启 Nginx 服务并检查日志"
}
\`\`\`

risk_level 说明：
- low: 只读操作、查看日志、检查状态
- medium: 重启服务、清理临时文件
- high: 删除数据、修改配置、影响业务`;

  const prompt = `## 告警信息
**标题**: ${alertTitle}
**内容**: ${alertContent || '(无详细内容)'}
${knowledgeContext}

## 设备诊断输出
${rawOutput.substring(0, 8000)}

## 要求
1. 判断根因
2. 分析异常指标
3. 给出修复建议
4. **必须**在诊断报告最后输出一个 JSON 代码块，包含可执行的修复命令
5. 修复命令应该是具体的 shell 命令，可以直接在设备上执行
6. 评估风险等级（low/medium/high）
7. 参考历史知识库中的方案，优先推荐已验证的修复方式`;

  try {
    const text = await generateCompletion(prompt, systemPrompt, 0.3);
    // 第一行为摘要
    const lines = text.trim().split('\n');
    const summary = lines[0].replace(/^[#*]*\s*/, '').substring(0, 100);

    // 提取 JSON 代码块中的修复命令
    let remediationCommands: string[] | undefined;
    let riskLevel: 'low' | 'medium' | 'high' | undefined;

    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(jsonData.remediation_commands)) {
          remediationCommands = jsonData.remediation_commands;
        }
        if (['low', 'medium', 'high'].includes(jsonData.risk_level)) {
          riskLevel = jsonData.risk_level;
        }
      } catch (parseErr) {
        logger.warn('Failed to parse remediation JSON:', parseErr);
      }
    }

    return { diagnosis: text, summary, remediationCommands, riskLevel };
  } catch (err: unknown) {
    logger.error('AI analysis failed:', err);
    return {
      diagnosis: `❌ AI 分析失败: ${getErrorMessage(err)}`,
      summary: 'AI 分析不可用',
    };
  }
}

// ====================== 告警分析编排 ======================

/** 分析单个告警的完整流程 */
export async function analyzeAlert(alertId: string, processingIds: Set<string>): Promise<AutoAnalysisResult | null> {
  if (processingIds.has(alertId)) {
    logger.debug(`Alert ${alertId} is already being analyzed`);
    return null;
  }

  // 检查是否已被AARS v2处理过
  if (isAlreadyProcessedByAARS(alertId)) {
    logger.debug(`Alert ${alertId} already processed by AARS v2, skipping`);
    return null;
  }

  const startTime = Date.now();
  processingIds.add(alertId);

  const analysisId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: AutoAnalysisResult = {
    id: analysisId,
    alert_id: alertId,
    device_id: '',
    device_name: '',
    device_ip: '',
    device_type: 'network_device',
    status: 'running',
    diagnosis: '',
    summary: '',
    raw_output: '',
    commands_executed: [],
    duration_ms: 0,
    created_at: new Date().toISOString(),
  };

  try {
    // 先写入 running 状态
    saveRecord(record);

    const alert = alertRepository.getEssentialById(alertId);
    if (!alert) {
      record.status = 'failed';
      record.error_message = '告警不存在';
      saveRecord(record);
      return record;
    }

    // 查找设备
    const device = findDeviceByAlert(alertId);
    if (!device) {
      record.status = 'failed';
      record.error_message = '未找到关联设备或无 SSH/SNMP 凭证，无法分析';
      record.summary = record.error_message;
      saveRecord(record);
      return record;
    }

    record.device_id = device.id;
    record.device_name = device.name;
    record.device_ip = device.ip_address;
    record.device_type = device.device_type;

    // 根据设备认证方式选择诊断路径
    let rawOutput = '';
    let commands: string[] = [];

    if (device.auth_method === 'ssh') {
      // SSH 登录并执行诊断
      logger.info(`🔐 SSH 诊断: ${device.name}(${device.ip_address}) 告警: ${alert.title}`);
      const result = await runSshDiagnosis(device, alert.title);
      rawOutput = result.rawOutput;
      commands = result.commands;
    } else if (device.auth_method === 'snmp') {
      // SNMP 巡检数据作为分析输入
      logger.info(`🔍 SNMP 巡检: ${device.name}(${device.ip_address}) 告警: ${alert.title}`);
      const snmpData = getSnmpInspectionData(device.id, device.name, device.ip_address);
      rawOutput = snmpData.rawOutput;
      commands = snmpData.commands;
    }

    record.raw_output = rawOutput;
    record.commands_executed = commands;

    // AI 分析
    logger.info(`🤖 AI 分析告警: ${alert.title}`);
    const { diagnosis, summary, remediationCommands, riskLevel } = await aiAnalyze(alert.title, alert.content || '', rawOutput);
    record.diagnosis = diagnosis;
    record.summary = summary;
    record.status = 'completed';

    // 自动上报告警已关联分析
    alertRepository.touchUpdated(alertId);

    logger.info(`✅ 告警自动分析完成: ${alertId} → ${summary}`);

    // ── AI 修复工作流（优先使用 AI 建议的修复命令） ──
    if (device.auth_method === 'ssh' && remediationCommands && remediationCommands.length > 0) {
      try {
        logger.info(`🔧 [AI Remediation] AI 建议了 ${remediationCommands.length} 条修复命令，创建修复工作流`);

        // 动态导入避免循环依赖
        const { aiRemediationService } = await import('../../../ai/services/remediation/aiRemediationService');

        const remediation = await aiRemediationService.createAndExecute({
          alertId,
          alertTitle: alert.title,
          alertContent: alert.content || '',
          alertSeverity: alert.severity || 'medium',
          deviceId: device.id,
          deviceName: device.name,
          deviceIp: device.ip_address,
          deviceType: device.device_type,
          diagnosis,
          remediationCommands,
          riskLevel: riskLevel || 'medium',
        });

        if (remediation) {
          logger.info(`✅ [AI Remediation] 修复工作流已创建: taskId=${remediation.task_id}, 等待审批`);
        }
      } catch (remediationErr: any) {
        logger.error(`❌ [AI Remediation] 创建修复工作流失败: ${remediationErr.message}`, remediationErr);
      }
    } else if (device.auth_method === 'ssh') {
      // AI 没有给出修复命令，尝试匹配预设策略
      try {
        const matching = await remediationService.matchAlertToPolicies({
          id: alertId,
          source: alert.source || 'itops',
          severity: alert.severity,
          title: alert.title,
          content: alert.content,
        });
        if (matching.length > 0) {
          logger.info(`🔧 匹配到 ${matching.length} 条修复策略，触发自动修复`);
          for (const policy of matching) {
            await remediationService.triggerRemediation(policy, {
              id: alertId,
              source: alert.source || 'itops',
              severity: alert.severity,
              title: alert.title,
              content: alert.content,
            });
          }
        } else {
          logger.info(`⏭️ SSH 设备 ${device.name} 无匹配修复策略，跳过`);
        }
      } catch (remediationErr: any) {
        logger.error(`❌ 触发修复工作流失败: ${remediationErr.message}`, remediationErr);
      }
    }
  } catch (err: unknown) {
    logger.error(`Alert auto-analysis failed for ${alertId}:`, err);
    record.status = 'failed';
    record.error_message = getErrorMessage(err);
    record.summary = getErrorMessage(err).substring(0, 100);
  }

  record.duration_ms = Date.now() - startTime;
  saveRecord(record);
  processingIds.delete(alertId);
  return record;
}
