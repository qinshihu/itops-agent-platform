/**
 * Agent 导入/导出 routes（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts L386-453 抽出：
 * - POST /import        (批量导入 JSON)
 * - GET  /export/:id    (单个导出 JSON)
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { validateBody, validateParams } from '../../../../middleware/validation';
import { agentSchemas } from '../../../../shared/schemas/apiValidation';
import { agentCrudService } from '../../services/agentCrudService';

const router = Router();

router.post('/import', validateBody(agentSchemas.importAgents), (req: Request, res: Response) => {
  try {
    const agents = req.body.agents;
    if (!Array.isArray(agents)) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid format: agents must be an array' });
    }

    const imported: string[] = [];
    for (const agent of agents) {
      const id = randomUUID();
      agentCrudService.createAgent({
        id,
        name: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        system_prompt: agent.system_prompt,
        model: agent.model || 'doubao-4o',
        temperature: agent.temperature ?? 0.7,
        enabled: agent.enabled !== false ? 1 : 0,
        is_preset: 0,
        category: agent.category || null,
        tags: agent.tags ? JSON.stringify(agent.tags) : null,
        description: agent.description || null,
      });
      imported.push(id);
    }

    res
      .status(201)
      .json({ success: true, data: { importedCount: imported.length, ids: imported } });
  } catch (error) {
    logger.error('Failed to import agents:', error);
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || 'Failed to import agents' });
  }
});

router.get('/export/:id', validateParams(agentSchemas.agentId), (req: Request, res: Response) => {
  try {
    const agent = agentCrudService.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const {
      id: _id,
      created_at: _created_at,
      updated_at: _updated_at,
      is_preset: _is_preset,
      usage_count: _usage_count,
      last_used_at: _last_used_at,
      ...exportData
    } = agent;
    const finalData = {
      ...exportData,
      tags: exportData.tags ? JSON.parse(exportData.tags) : [],
    };
    res.json({ success: true, data: finalData });
  } catch (error) {
    logger.error('Failed to export agent:', error);
    res
      .status(500)
      .json({ success: false, error: (error as Error).message || 'Failed to export agent' });
  }
});

export default router;
