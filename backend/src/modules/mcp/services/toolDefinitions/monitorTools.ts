import { z } from 'zod';
import { type RegisteredTool, RiskLevel } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
import { alertConfigsRepo } from '../../../../repositories';

export const monitorTools: RegisteredTool[] = [
  {
    name: 'alert.list',
    title: '查询告警列表',
    description: '查询告警中心告警列表，支持按严重级别、状态、时间范围过滤。返回只读告警事实数据。',
    domain: 'alert_handling',
    annotations: READONLY,
    inputSchema: z.object({
      severity: z.enum(['critical', 'warning', 'info']).optional().describe('告警严重级别'),
      status: z.enum(['active', 'acknowledged', 'resolved']).optional().describe('告警状态'),
      limit: z.number().min(1).max(100).default(20).describe('返回数量'),
      offset: z.number().min(0).default(0).describe('偏移量'),
    }),
    handler: async (args) => {
      try {
        const alerts = alertConfigsRepo.listNotifications({
          level: args.severity,
          status: args.status,
          limit: args.limit || 20,
          offset: args.offset || 0,
        });
        return jsonResult(alerts, `找到 ${alerts?.length || 0} 条告警`);
      } catch (err) {
        return textResult(`查询告警失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'alert.analyze',
    title: '分析告警根因',
    description: '对指定告警进行 AI 根因分析（RCA），返回分析结论、依据和建议动作。',
    domain: 'alert_handling',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      riskLevel: RiskLevel.LOW,
      requiresApproval: false,
    },
    inputSchema: z.object({
      alertId: z.string().describe('告警 ID'),
      includeMetrics: z.boolean().default(false).describe('是否包含关联指标'),
    }),
    handler: async (args, _ctx) => {
      try {
        const { rootCauseAnalysisService } = await import(
          '../../../../modules/ai/services/rca/rootCauseAnalysisService'
        );
        const result = await rootCauseAnalysisService.analyze(args.alertId as string);
        return jsonResult(result, '告警根因分析完成');
      } catch (err) {
        return textResult(`根因分析失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'alert.correlate',
    title: '告警关联分析',
    description: '查询与指定告警相关联的其他告警，发现潜在关联关系。',
    domain: 'alert_handling',
    annotations: READONLY,
    inputSchema: z.object({
      alertId: z.string().describe('告警 ID'),
      timeWindowMinutes: z.number().min(5).max(1440).default(60).describe('时间窗口（分钟）'),
      limit: z.number().min(1).max(50).default(10).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { alertCorrelationService } = await import(
          '../../../../modules/alerts/services/alertCorrelationService'
        );
        const correlated = (alertCorrelationService as any).findCorrelated
          ? (alertCorrelationService as any).findCorrelated(args.alertId, args.timeWindowMinutes)
          : { message: '告警关联服务正在初始化中', alerts: [] };
        return jsonResult(correlated, '告警关联分析完成');
      } catch (err) {
        return textResult(`关联分析失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'monitor.health',
    title: '查询系统健康状态',
    description: '查询整体系统健康状态，包含各服务健康检查结果和资源使用。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const { healthService } = await import('../../../../modules/monitor/services/healthService');
        const health = await healthService.checkHealth();
        return jsonResult(health, `系统健康状态: ${health.status}`);
      } catch (err) {
        return textResult(`查询健康状态失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'monitor.metrics',
    title: '查询系统指标',
    description: '查询系统运行指标（CPU、内存、磁盘、网络），支持时间范围。',
    domain: 'system_inspection',
    annotations: READONLY,
    inputSchema: z.object({
      metricType: z.enum(['cpu', 'memory', 'disk', 'network']).optional().describe('指标类型'),
      hostId: z.string().optional().describe('主机 ID'),
      minutes: z.number().min(5).max(1440).default(15).describe('时间范围（分钟）'),
    }),
    handler: async (args) => {
      try {
        const { selfMonitorService } = await import(
          '../../../../modules/monitor/services/selfMonitorService'
        );
        const report = selfMonitorService.getLastReport();
        return jsonResult(
          { report, query: args },
          report ? '系统指标（最近一次检查）' : '监控数据正在初始化'
        );
      } catch (err) {
        return textResult(`查询指标失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];