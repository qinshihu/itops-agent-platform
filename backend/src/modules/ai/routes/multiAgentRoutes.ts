/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import {
  executeTask,
  getCoordinator,
  specialistRegistry,
} from '../services/multiAgent';
import { agentExecutionCrudService } from '../services/agentExecutionCrudService';

const router = Router();

// ==================== 任务执行 API ====================

/**
 * POST /api/multi-agent/task
 * 执行运维任务（使用双层 Agent 架构）
 */
router.post('/task', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { input, userId, context } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Task input is required',
      });
    }

    const taskStartTime = Date.now();
    const result = await executeTask(input, userId);

    // 保存执行记录
    const executionId = randomUUID();
    try {
      agentExecutionCrudService.createExecution({
        id: executionId,
        agentId: result.agentId,
        agentName: result.agentName,
        inputText: input,
        outputText: result.result?.output || '',
        status: result.status,
        errorMessage: result.result?.error || null,
        executionTimeMs: Date.now() - taskStartTime,
        metadata: {
          multiAgent: true,
          context: context || null,
          delegatedTo: result.delegatedTo || null,
        },
      });
    } catch (dbErr) {
      logger.error('保存执行记录失败', dbErr);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('双层 Agent 任务执行失败', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Task execution failed',
    });
  }
});

// ==================== Specialist 管理 API ====================

/**
 * GET /api/multi-agent/specialists
 * 获取所有 Specialist
 */
router.get('/specialists', (req: Request, res: Response) => {
  try {
    const { domain, enabled } = req.query;
    let specialists;

    if (domain) {
      specialists = specialistRegistry.getByDomain(domain as any);
    } else {
      specialists = specialistRegistry.getAll();
    }

    if (enabled !== undefined) {
      specialists = specialists.filter(s => s.enabled === (enabled === 'true'));
    }

    const data = specialists.map(s => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      capabilities: s.capabilities,
      temperature: s.temperature,
      enabled: s.enabled,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    logger.error('GET /multi-agent/specialists failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get specialists',
    });
  }
});

/**
 * GET /api/multi-agent/specialists/select
 * 为任务选择最合适的 Specialist
 */
router.get('/specialists/select', (req: Request, res: Response) => {
  try {
    const { input } = req.query;
    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Input is required',
      });
    }

    const specialist = specialistRegistry.selectBestSpecialistForTask(input as string);
    if (!specialist) {
      return res.json({
        success: true,
        data: null,
        message: 'No suitable specialist found',
      });
    }

    res.json({
      success: true,
      data: {
        id: specialist.id,
        name: specialist.name,
        domain: specialist.domain,
        capabilities: specialist.capabilities,
      },
    });
  } catch (error) {
    logger.error('GET /multi-agent/specialists/select failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to select specialist',
    });
  }
});

/**
 * POST /api/multi-agent/specialists/:id/execute
 * 直接执行某个 Specialist
 */
router.post('/specialists/:id/execute', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { input, context } = req.body;

    if (!input) {
      return res.status(400).json({
        success: false,
        error: 'Input is required',
      });
    }

    const specialist = specialistRegistry.getById(id);

    if (!specialist) {
      return res.status(404).json({
        success: false,
        error: 'Specialist not found',
      });
    }

    if (!specialist.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Specialist is disabled',
      });
    }

    const taskContext = {
      taskId: randomUUID(),
      input,
      timestamp: Date.now(),
      metadata: context,
    };

    const startTime = Date.now();
    const result = await specialist.execute(taskContext);

    res.json({
      success: true,
      data: {
        specialistId: specialist.id,
        specialistName: specialist.name,
        result,
        executionTime: Date.now() - startTime,
      },
    });
  } catch (error) {
    logger.error('POST /multi-agent/specialists/:id/execute failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute specialist',
    });
  }
});

// ==================== 系统信息 API ====================

/**
 * GET /api/multi-agent/status
 * 获取系统状态
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const coordinator = getCoordinator();
    const allSpecialists = specialistRegistry.getAll();
    const enabledSpecialists = specialistRegistry.getEnabled();

    res.json({
      success: true,
      data: {
        initialized: true,
        coordinator: {
          id: coordinator.id,
          name: coordinator.name,
        },
        specialists: {
          total: allSpecialists.length,
          enabled: enabledSpecialists.length,
          domains: [...new Set(allSpecialists.map(s => s.domain))],
        },
      },
    });
  } catch (error) {
    logger.error('GET /multi-agent/status failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status',
    });
  }
});

export default router;