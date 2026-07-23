/**
 * Agent 执行 routes（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts L191-277 抽出：
 * - POST /:id/test (测试 Agent 执行，调用 executeAgentWithLLM 或 executeAgentNode)
 *
 * 这是 P1-7 v2 (2026-07-21) 中的关键：服务器类/数据库运维 Agent 用增强执行器，
 * 其他 Agent 用 LLM 执行；保存执行记录到 agent_executions。
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { requireRole } from '../../../../middleware/auth';
import { validateBody, validateParams } from '../../../../middleware/validation';
import { agentSchemas } from '../../../../shared/schemas/apiValidation';
import { agentCrudService } from '../../services/agentCrudService';
import { executeAgentWithLLM } from '../../services/llm/llmService';
import { executeAgentNode } from '../../services/agents/agentExecutor';

const router = Router();

// POST /:id/test - 测试 Agent 执行（高风险：实际执行 LLM/工具链）
router.post(
  '/:id/test',
  requireRole('admin', 'operator'),
  validateParams(agentSchemas.agentId),
  validateBody(agentSchemas.testAgent),
  async (req: Request, res: Response) => {
    try {
      const { input, serverId, serverIds, context, databaseId } = req.body;
      const agent = agentCrudService.getAgentById(req.params.id);

      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }

      const executionId = randomUUID();
      const startTime = Date.now();
      const agentName = agent.name;

      let output = '';
      let status = 'success';
      let errorMessage: string | null = null;

      // 构建上下文
      const executionContext: Record<string, unknown> = {
        ...context,
        serverIds:
          serverIds && serverIds.length > 0 ? serverIds : serverId ? [serverId] : undefined,
        databaseId: databaseId || undefined,
      };

      try {
        // 检查是否是服务器相关Agent或数据库运维Agent，如果是，就用增强的执行器
        if (
          agentName.includes('服务器') ||
          agentName.includes('巡检') ||
          agentName.includes('数据库运维')
        ) {
          output = await executeAgentNode(agent.id, input, executionContext);
        } else {
          // 其他Agent用LLM执行
          output = await executeAgentWithLLM(agent.id, input);
        }
      } catch (error: unknown) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
        output = `Agent "${agentName}" 执行失败: ${errorMessage}`;
        logger.error(`Agent execution failed for ${agentName}:`, error);
      }

      const executionTime = Date.now() - startTime;

      // 保存执行记录
      agentCrudService.createExecution({
        id: executionId,
        agentId: req.params.id,
        agentName: agent.name,
        inputText: input,
        outputText: output,
        status,
        errorMessage,
        executionTimeMs: executionTime,
        metadata: { test: true, context: executionContext, serverId, serverIds, databaseId },
      });

      // 更新Agent使用统计
      agentCrudService.incrementUsageStats(req.params.id);

      res.json({
        success: true,
        data: {
          executionId,
          output,
          status,
          executionTime,
          metadata: {
            serverId,
            databaseId,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to test agent:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to test agent' });
    }
  },
);

export default router;
