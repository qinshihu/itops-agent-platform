/**
 * Agent CRUD routes（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts 抽出的 CRUD 类路由：
 * - GET /             (list)
 * - GET /:id          (get)
 * - GET /:id/executions (list executions)
 * - POST /            (create)
 * - PUT /:id          (update)
 * - DELETE /:id       (delete)
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」+
 * §3.2 routes-禁止直访-Repository（p1-5）：所有数据访问通过 agentCrudService
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { requireRole } from '../../../../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../../../../middleware/validation';
import { agentSchemas } from '../../../../shared/schemas/apiValidation';
import { agentCrudService } from '../../services/agentCrudService';

const router = Router();

// 解析 tags 字段（JSON 字符串 → 数组）
function parseAgentTags<T extends { tags?: string | null }>(agent: T): T & { tags: unknown[] } {
  return { ...agent, tags: agent.tags ? JSON.parse(agent.tags) : [] };
}

// GET / - 列表
router.get('/', validateQuery(agentSchemas.listAgentsQuery), (req: Request, res: Response) => {
  try {
    const { category, enabled, search } = req.query;
    const agents = agentCrudService.listAgents({
      category: category as string | undefined,
      enabled: enabled !== undefined ? (enabled === 'true' ? 1 : 0) : undefined,
      search: search as string | undefined,
    });
    const processedAgents = agents.map(parseAgentTags);
    res.json({ success: true, data: processedAgents });
  } catch (error) {
    logger.error('Failed to fetch agents:', error);
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || 'Failed to fetch agents' });
  }
});

// GET /:id - 单个详情
router.get('/:id', validateParams(agentSchemas.agentId), (req: Request, res: Response) => {
  try {
    const agent = agentCrudService.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({ success: true, data: parseAgentTags(agent) });
  } catch (error) {
    logger.error('Failed to fetch agent:', error);
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || 'Failed to fetch agent' });
  }
});

// 注：2026-07-23 删除 GET /:id/executions（前端无消费者）

// POST / - 创建
router.post(
  '/',
  requireRole('admin', 'operator'),
  validateBody(agentSchemas.createAgent),
  (req: Request, res: Response) => {
    try {
      const {
        name,
        avatar,
        role,
        system_prompt,
        model,
        temperature,
        enabled,
        category,
        tags,
        description,
        api_provider,
        primary_model_id,
        fallback_model_id,
      } = req.body;
      const id = (req as Request & { generateId?: () => string }).generateId?.() || randomUUID();

      agentCrudService.createAgent({
        id,
        name,
        avatar,
        role,
        system_prompt,
        model,
        temperature,
        enabled: enabled ? 1 : 0,
        is_preset: 0,
        category: category || null,
        tags: tags ? JSON.stringify(tags) : null,
        description: description || null,
        api_provider: api_provider || 'doubao',
        primary_model_id: primary_model_id || null,
        fallback_model_id: fallback_model_id || null,
      });
      const agent = agentCrudService.getAgentById(id);
      res.status(201).json({ success: true, data: parseAgentTags(agent!) });
    } catch (error) {
      logger.error('Failed to create agent:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to create agent' });
    }
  },
);

// PUT /:id - 更新
router.put(
  '/:id',
  requireRole('admin', 'operator'),
  validateParams(agentSchemas.agentId),
  validateBody(agentSchemas.updateAgent),
  (req: Request, res: Response) => {
    try {
      const {
        name,
        avatar,
        role,
        system_prompt,
        model,
        temperature,
        enabled,
        category,
        tags,
        description,
        api_provider,
        primary_model_id,
        fallback_model_id,
      } = req.body;

      agentCrudService.updateAgent(req.params.id, {
        name,
        avatar,
        role,
        system_prompt,
        model,
        temperature,
        enabled: enabled ? 1 : 0,
        category: category || null,
        tags: tags ? JSON.stringify(tags) : null,
        description: description || null,
        api_provider: api_provider || 'doubao',
        primary_model_id: primary_model_id || null,
        fallback_model_id: fallback_model_id || null,
      });

      const agent = agentCrudService.getAgentById(req.params.id);
      res.json({ success: true, data: parseAgentTags(agent!) });
    } catch (error) {
      logger.error('Failed to update agent:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to update agent' });
    }
  },
);

// DELETE /:id
router.delete(
  '/:id',
  requireRole('admin', 'operator'),
  validateParams(agentSchemas.agentId),
  (req: Request, res: Response) => {
    try {
      const agent = agentCrudService.getAgentById(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent not found' });
      }

      agentCrudService.deleteAgent(req.params.id);
      res.json({ success: true, message: 'Agent deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete agent:', error);
      res
        .status(500)
        .json({ success: false, error: (error as Error).message || 'Failed to delete agent' });
    }
  },
);

export default router;
