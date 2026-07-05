/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { type RegisteredTool } from '../types';
import { textResult, jsonResult, READONLY } from './shared';

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
        // eslint-disable-next-line no-restricted-imports
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM remediation_policies WHERE 1=1';
        const params: unknown[] = [];
        if (args.enabled !== undefined) { query += ' AND enabled = ?'; params.push(args.enabled ? 1 : 0); }
        query += ` LIMIT ${args.limit || 20}`;
        const policies = db.prepare(query).all(...params);
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
        // eslint-disable-next-line no-restricted-imports
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM remediation_audit WHERE 1=1';
        const params: any[] = [];
        if (args.status) { query += ' AND status = ?'; params.push(args.status); }
        query += ' ORDER BY executed_at DESC';
        query += ` LIMIT ${args.limit || 20}`;
        const audits = db.prepare(query).all(...params);
        return jsonResult(audits, `找到 ${(audits as any[])?.length || 0} 条修复审计`);
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
        // eslint-disable-next-line no-restricted-imports
        const { default: db } = await import('../../../../models/database');
        let query = 'SELECT * FROM knowledge WHERE 1=1';
        const params: any[] = [];
        if (args.query) {
          query += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
          params.push(`%${args.query}%`, `%${args.query}%`, `%${args.query}%`);
        }
        if (args.category) { query += ' AND category = ?'; params.push(args.category); }
        query += ` LIMIT ${args.limit || 5}`;
        const results = db.prepare(query).all(...params);
        return jsonResult(results, `找到 ${(results as any[])?.length || 0} 条知识`);
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
        // eslint-disable-next-line no-restricted-imports
        const { default: db } = await import('../../../../models/database');
        let query = `
          SELECT cs.id, cs.title, cs.status, cs.model_name, cs.created_at,
            COUNT(cm.id) as message_count
          FROM chat_sessions cs
          LEFT JOIN chat_messages cm ON cs.id = cm.session_id
          WHERE 1=1
        `;
        const params: unknown[] = [];
        if (args.status) { query += ' AND cs.status = ?'; params.push(args.status); }
        query += ' GROUP BY cs.id ORDER BY cs.created_at DESC';
        query += ` LIMIT ${args.limit || 10}`;
        const sessions = db.prepare(query).all(...params);
        return jsonResult(sessions, `找到 ${sessions.length} 个会话`);
      } catch (err) {
        return textResult(`查询会话失败: ${(err as Error).message}`, true);
      }
    },
    enabled: true,
  },
];
