import { z } from 'zod';
import { type RegisteredTool } from '../types';
import { textResult, jsonResult, READONLY } from './shared';
import { remediationPolicyRepository } from '../../../../repositories';
import { remediationAuditRepository } from '../../../../repositories';
import { knowledgeRepository } from '../../../../repositories';
import { chatSessionRepository } from '../../../../repositories';

export const aiTools: RegisteredTool[] = [
  {
    name: 'remediation.policy.list',
    title: '查询修复策略',
    description: '查询自动化修复策略列表，包含匹配条件、修复动作、执行历史。',
    domain: 'change_execution',
    annotations: READONLY,
    inputSchema: z.object({
      enabled: z.boolean().optional().describe('是否启用'),
      limit: z.number().min(1).max(50).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const policies = remediationPolicyRepository.listForMcp(
          args.enabled !== undefined ? (args.enabled ? 1 : 0) : undefined,
          args.limit || 20
        );
        return jsonResult(policies, `找到 ${policies.length} 条修复策略`);
      } catch (err) {
        return textResult(`查询修复策略失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'remediation.audit',
    title: '查询修复审计',
    description: '查询自动化修复的执行审计记录，包含触发告警、修复动作、执行结果。',
    domain: 'change_execution',
    annotations: READONLY,
    inputSchema: z.object({
      status: z.enum(['success', 'failed', 'pending', 'rollback']).optional().describe('执行状态'),
      limit: z.number().min(1).max(100).default(20).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const { audits } = remediationAuditRepository.listWithJoins({
          status: args.status,
          limit: args.limit || 20,
        });
        return jsonResult(audits, `找到 ${audits?.length || 0} 条修复审计`);
      } catch (err) {
        return textResult(`查询修复审计失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'aiops.knowledge',
    title: '查询 AIOps 知识图谱',
    description: '查询运维知识图谱，按环境、系统或服务搜索历史排障经验和最佳实践。',
    domain: 'document_generation',
    annotations: READONLY,
    inputSchema: z.object({
      query: z.string().describe('搜索关键词'),
      category: z.string().optional().describe('知识分类'),
      limit: z.number().min(1).max(20).default(5).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const results = knowledgeRepository.searchMcp({
          query: args.query,
          category: args.category,
          limit: args.limit || 5,
        });
        return jsonResult(results, `找到 ${results?.length || 0} 条知识`);
      } catch (err) {
        return textResult(`查询知识图谱失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },

  {
    name: 'aiops.session.list',
    title: '查询 AI 会话列表',
    description: '查询 AI Agent 会话历史，包含用户问题、Agent 回答、工具调用统计。',
    domain: 'document_generation',
    annotations: READONLY,
    inputSchema: z.object({
      status: z.enum(['active', 'completed', 'failed']).optional().describe('会话状态'),
      limit: z.number().min(1).max(50).default(10).describe('返回数量'),
    }),
    handler: async (args) => {
      try {
        const sessions = chatSessionRepository.listWithMessageCount({
          status: args.status,
          limit: args.limit || 10,
        });
        return jsonResult(sessions, `找到 ${(sessions as unknown[]).length} 个会话`);
      } catch (err) {
        return textResult(`查询会话失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];