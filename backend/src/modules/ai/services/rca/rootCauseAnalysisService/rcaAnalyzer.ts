/* eslint-disable @typescript-eslint/no-explicit-any */
import { networkDeviceRepository, serversRepo, alertRepository, deviceAssociationsRepo } from '../../../../../repositories';
import { generateCompletion } from '../../llm/llmService';
import { localRuleEngine } from '../localRuleEngine';
import { logger } from '../../../../../utils/logger';
import { topologyService } from '../../../../network/services/topologyService';
import { changeService } from '../../../../change-management/services/changeService';
import EnhancedRAGService from '../../remediation/enhancedRAGService';
import { RCA_PROMPT } from '../../../prompts/rcaPrompt';
import type { RootCauseAnalysis, UpdateRCAInput } from './rcaTypes';

const ragService = new EnhancedRAGService();

export function performRuleEngineAnalysis(rca: RootCauseAnalysis): UpdateRCAInput {
  let alertInfo = { title: rca.title, content: rca.description || '' };

  if (rca.alert_id) {
    const alert = alertRepository.getById(rca.alert_id);
    if (alert) {
      alertInfo = alert;
    }
  }

  const ruleResult = localRuleEngine.analyzeByRules(alertInfo.title, alertInfo.content);

  const timeline = ruleResult.timeline.map(t => ({ time: t.time, event: t.event }));

  return {
    status: 'completed',
    root_cause: ruleResult.rootCause,
    symptoms: ruleResult.symptoms,
    timeline,
    evidence: ruleResult.evidence,
    recommendations: ruleResult.recommendations
  };
}

export function generateFallbackAnalysis(rca: RootCauseAnalysis): UpdateRCAInput {
  const fallbackSymptoms = [
    '需要进一步系统检查',
    '建议查看相关日志',
    '需要人工介入分析'
  ];

  const fallbackTimeline = [
    { time: new Date().toISOString().replace('T', ' ').substring(0, 19), event: '开始根因分析' },
    { time: new Date().toISOString().replace('T', ' ').substring(0, 19), event: '分析完成，需要人工验证' }
  ];

  const fallbackEvidence = [
    '需要人工收集更多证据',
    '建议查看系统日志和应用日志'
  ];

  const fallbackRecommendations = [
    '人工检查系统状态',
    '查看相关日志文件',
    '配置合适的LLM API以获得更好的分析结果'
  ];

  return {
    status: 'completed',
    root_cause: `需要人工调查 ${rca.title} 的详细原因。建议检查系统日志、监控指标和相关配置。`,
    symptoms: fallbackSymptoms,
    timeline: fallbackTimeline,
    evidence: fallbackEvidence,
    recommendations: fallbackRecommendations
  };
}
export async function performLLMAnalysis(rca: RootCauseAnalysis): Promise<UpdateRCAInput> {
  // 获取告警信息（如果有关联告警）
  let alertInfo = '';
  if (rca.alert_id) {
    const alert = alertRepository.getById(rca.alert_id);
    if (alert) {
      alertInfo = `
告警标题: ${alert.title}
告警内容: ${alert.content}
告警级别: ${alert.severity}
告警来源: ${alert.source}
`;
    }
  }

  const prompt = `作为专业的IT运维根因分析专家，请对以下告警进行深入的根因分析。

分析主题: ${rca.title}
${rca.description ? `问题描述: ${rca.description}` : ''}
${alertInfo}

请按照以下结构输出分析结果（JSON格式）:
{
  "root_cause": "详细的根因描述",
  "symptoms": ["症状1", "症状2", "症状3"],
  "timeline": [
    {"time": "时间", "event": "事件描述"}
  ],
  "evidence": ["证据1", "证据2"],
  "recommendations": ["建议1", "建议2", "建议3"]
}

要求：
1. root_cause: 深入分析根本原因
2. symptoms: 列出观察到的症状
3. timeline: 构建故障发生的时间线
4. evidence: 分析过程中收集的证据
5. recommendations: 提供具体的修复和预防建议`;

  try {
    const response = await generateCompletion(prompt);

    // 解析LLM响应
    let analysisData;
    try {
      const jsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
      let jsonStr: string | null = null;
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
      } else {
        const lastBrace = response.lastIndexOf('}');
        const firstBrace = response.lastIndexOf('{', lastBrace);
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = response.substring(firstBrace, lastBrace + 1);
        }
      }
      if (jsonStr) {
        analysisData = JSON.parse(jsonStr);
      } else {
        throw new Error('无法解析LLM响应');
      }
    } catch {
      analysisData = {
        root_cause: response.substring(0, 500),
        symptoms: ['系统异常'],
        timeline: [],
        evidence: [],
        recommendations: ['进一步调查']
      };
    }

    return {
      status: 'completed',
      root_cause: analysisData.root_cause,
      symptoms: analysisData.symptoms,
      timeline: analysisData.timeline,
      evidence: analysisData.evidence,
      recommendations: analysisData.recommendations
    };
  } catch (error) {
    throw new Error('LLM分析失败: ' + (error as Error).message);
  }
}
/** 根据告警查找关联设备（优先 network_devices，再查 servers） */
export function findDeviceByAlert(alertId: string): {
  id: string;
  name: string;
  ip_address: string;
  device_type: 'server' | 'network_device';
} | null {
  try {
    // 1. 查 alert_device_associations
    const assoc = deviceAssociationsRepo.getByAlertId(alertId);

    if (assoc) {
      if (assoc.device_type === 'network_device') {
        const nd = networkDeviceRepository.getById(assoc.device_id);
        if (nd) {
          return {
            id: nd.id,
            name: nd.name,
            ip_address: nd.ip_address,
            device_type: 'network_device',
          };
        }
      } else {
        // server
        const sv = serversRepo.getById(assoc.device_id);
        if (sv) {
          return {
            id: sv.id,
            name: sv.name,
            ip_address: ((sv.hostname ?? '') || sv.ip_address) ?? '',
            device_type: 'server',
          };
        }
      }
    }

    // 2. 回退：直接从 alert 的 metadata/host 字段提取 IP 匹配
    const alert = alertRepository.getById(alertId);
    if (!alert) return null;

    const metadata = (typeof alert.metadata === 'string'
      ? JSON.parse(alert.metadata || '{}')
      : alert.metadata) || {} as Record<string, unknown>;
    const possibleIps: string[] = [];

    // 从 metadata.host / annotations / labels 中找 IP
    if (metadata.host) possibleIps.push(metadata.host);
    if (metadata.labels?.instance) possibleIps.push(metadata.labels.instance);
    if (metadata.annotations?.instance) possibleIps.push(metadata.annotations.instance);

    // 从标题和内容中正则匹配 IP
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const titleIps = alert.title.match(ipRegex) || [];
    const contentIps = alert.content?.match(ipRegex) || [];
    possibleIps.push(...titleIps, ...contentIps);

    for (const ip of [...new Set(possibleIps)]) {
      // 查 network_devices
      const nd = networkDeviceRepository.getByIp(ip);
      if (nd) {
        return {
          id: nd.id,
          name: nd.name,
          ip_address: ip,
          device_type: 'network_device',
        };
      }
      // 查 servers（匹配 hostname、ip_address、private_ip 三个字段）
      const sv = serversRepo.getByIp(ip);
      if (sv) {
        return {
          id: sv.id,
          name: sv.name,
          ip_address: sv.hostname || sv.ip_address || sv.private_ip || '',
          device_type: 'server',
        };
      }
    }
  } catch {
    // 查找设备失败，忽略
  }

  return null;
}

/** 从 recommendations 中提取具体的修复命令 */
export function extractCommandsFromRecommendations(recommendations: string[]): string[] {
  const commands: string[] = [];
  const commandPatterns = [
    /^(?:systemctl|service|docker|docker-compose|kubectl|mkdir|rm|mv|cp|chmod|chown|touch|echo|cat|grep|sed|awk|tail|head|kill|pkill|sysctl|ulimit|date|uptime|free|df|netstat|ss|top|ps|ls|cd)\s+.+$/,
    /`([^`]+)`/,
    /```(?:bash|sh|shell)?\s*([\s\S]*?)\s*```/,
  ];

  for (const rec of recommendations) {
    // 尝试匹配完整命令行
    const match1 = rec.match(commandPatterns[0]);
    if (match1) {
      commands.push(match1[0].trim());
      continue;
    }
    // 尝试匹配反引号中的命令
    const match2 = rec.match(commandPatterns[1]);
    if (match2) {
      commands.push(match2[1].trim());
      continue;
    }
    // 尝试匹配代码块
    const match3 = rec.match(commandPatterns[2]);
    if (match3) {
      // 分割多行命令
      const lines = match3[1].split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0 && !l.startsWith('#'));
      commands.push(...lines);
      continue;
    }
  }

  // 去重
  return [...new Set(commands)];
}

function safeInject(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedKey, 'g');
    result = result.replace(regex, value);
  }
  return result;
}
export async function collectContext(alert: {
  id: string;
  title: string;
  content: string;
  severity: string;
  source: string;
  server_id?: string;
  created_at: string;
}) {
  const context: Record<string, unknown> = {
    alert: {
      id: alert.id,
      title: alert.title,
      content: alert.content,
      severity: alert.severity,
      source: alert.source,
      triggered_at: alert.created_at
    },
    topology: [],
    recentChanges: [],
    relatedAlerts: [],
    serverStatus: null,
    knowledgeMatches: []
  };

  if (alert.server_id) {
    try {
      const topology = topologyService.getServerTopology(alert.server_id);
      context.topology = topology;
    } catch (error) {
      logger.warn(`⚠️ [RCA] 获取拓扑信息失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      context.recentChanges = changeService.getRecentByServer(alert.server_id, 24);
    } catch (error) {
      logger.warn(`⚠️ [RCA] 获取变更记录失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    try {
      context.serverStatus = serversRepo.getById(alert.server_id);
    } catch (error) {
      logger.warn(`⚠️ [RCA] 获取服务器状态失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  try {
    const oneHourAgo = new Date(new Date(alert.created_at).getTime() - 3600000).toISOString();
    const rawAlerts = alertRepository.listRecentExcludingId(alert.id, oneHourAgo, 10);
    context.relatedAlerts = rawAlerts.map(a => {
      const alertCopy = { ...a };
      if (alertCopy.content && typeof alertCopy.content === 'string') {
        alertCopy.content = alertCopy.content.substring(0, 500);
      }
      return alertCopy;
    });
  } catch (error) {
    logger.warn(`⚠️ [RCA] 获取关联告警失败: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  try {
    const knowledgeResults = await ragService.search(alert.title, { limit: 5, minScore: 0.2 });
    context.knowledgeMatches = knowledgeResults.map(r => ({
      title: r.item.title,
      score: r.score,
      content: r.item.content.substring(0, 500)
    }));
  } catch (error) {
    logger.warn(`⚠️ [RCA] 知识匹配失败: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return context;
}
export async function analyzeWithLLM(alert: {
  id: string;
  title: string;
  content: string;
  severity: string;
}, context: Record<string, unknown>): Promise<UpdateRCAInput | null> {
  const replacements: Record<string, string> = {
    '{alert_id}': alert.id,
    '{alert_title}': alert.title,
    '{severity}': alert.severity,
    '{alert_message}': alert.content,
    '{triggered_at}': context.alert ? (context.alert as Record<string, string>).triggered_at || '' : '',
    '{server_name}': context.serverStatus ? (context.serverStatus as Record<string, string>).name || '未知' : '未知',
    '{server_ip}': context.serverStatus ? (context.serverStatus as Record<string, string>).hostname || '未知' : '未知',
    '{server_status}': context.serverStatus ? (context.serverStatus as Record<string, string>).status || '未知' : '未知',
    '{topology_info}': JSON.stringify(context.topology, null, 2).substring(0, 2000),
    '{change_records}': JSON.stringify(context.recentChanges, null, 2).substring(0, 2000),
    '{related_alerts}': JSON.stringify(context.relatedAlerts, null, 2).substring(0, 2000),
    '{knowledge_matches}': JSON.stringify(context.knowledgeMatches, null, 2).substring(0, 2000)
  };

  const prompt = safeInject(RCA_PROMPT, replacements);

  try {
    const response = await generateCompletion(prompt);

    let analysisData;
    try {
      const jsonBlockMatch = response.match(/```json\s*\n([\s\S]*?)\n?\s*```/);
      let jsonStr: string | null = null;
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
      } else {
        const lastBrace = response.lastIndexOf('}');
        const firstBrace = response.lastIndexOf('{', lastBrace);
        if (firstBrace !== -1 && lastBrace !== -1) {
          jsonStr = response.substring(firstBrace, lastBrace + 1);
        }
      }
      if (jsonStr) {
        analysisData = JSON.parse(jsonStr);
      } else {
        throw new Error('无法解析LLM响应');
      }
    } catch {
      logger.warn(`⚠️ [RCA] LLM响应解析失败，使用回退分析`);
      analysisData = null;
    }

    if (!analysisData) {
      return generateFallbackAnalysis({
        id: '',
        alert_id: alert.id,
        title: alert.title,
        description: alert.content,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as RootCauseAnalysis);
    }

    return {
      status: 'completed',
      root_cause: analysisData.root_cause || '需要进一步调查',
      symptoms: analysisData.symptoms || ['系统异常'],
      timeline: analysisData.timeline || [],
      evidence: analysisData.evidence || [],
      recommendations: analysisData.recommendations || ['进一步调查']
    };
  } catch (error) {
    logger.error(`❌ [RCA] LLM调用失败: ${error instanceof Error ? error.message : 'Unknown'}`);
    throw error;
  }
}