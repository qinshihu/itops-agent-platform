import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { agentRepository, agentExecutionRepository } from '../../../repositories';
import { executeAgentWithLLM } from '../services/llm/llmService';
import { executeAgentNode } from '../services/agents/agentExecutor';
import { requireRole } from '../../../middleware/auth';
import { agentToolRegistry } from '../services/agents/agentToolRegistry';

const router = Router();

// 解析 tags 字段（JSON 字符串 → 数组）
function parseAgentTags<T extends { tags?: string | null }>(agent: T): T & { tags: unknown[] } {
  return { ...agent, tags: agent.tags ? JSON.parse(agent.tags) : [] };
}

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, enabled, search } = req.query;
    const agents = agentRepository.list({
      category: category as string | undefined,
      enabled: enabled !== undefined ? (enabled === 'true' ? 1 : 0) : undefined,
      search: search as string | undefined,
    });
    const processedAgents = agents.map(parseAgentTags);
    res.json({ success: true, data: processedAgents });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// 获取Agent统计信息
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const totalAgents = agentRepository.countAll();
    const enabledAgents = agentRepository.countEnabled();
    const presetAgents = agentRepository.countPreset();
    const totalExecutions = agentExecutionRepository.countAll();
    const categoryStats = agentRepository.countByCategory();

    res.json({
      success: true,
      data: {
        totalAgents,
        enabledAgents,
        presetAgents,
        totalExecutions,
        categoryStats
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agent stats' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const agent = agentRepository.getByIdWithModels(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({ success: true, data: parseAgentTags(agent) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agent' });
  }
});

// 获取Agent执行历史
router.get('/:id/executions', (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    const executions = agentExecutionRepository.listByAgent(req.params.id, {
      status: status as string | undefined,
      limit: limitNum,
      offset: offsetNum,
    });

    const totalCount = agentExecutionRepository.countByAgent(req.params.id, status as string | undefined);

    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          total: totalCount,
          limit: limitNum,
          offset: offsetNum
        }
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agent executions' });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, avatar, role, system_prompt, model, temperature, enabled, category, tags, description, api_provider, primary_model_id, fallback_model_id } = req.body;
    const id = randomUUID();

    agentRepository.create({
      id,
      name,
      avatar,
      role,
      system_prompt,
      model: model || 'doubao-4o',
      temperature: temperature ?? 0.7,
      enabled: enabled !== false ? 1 : 0,
      is_preset: 0,
      category: category || null,
      tags: tags ? JSON.stringify(tags) : null,
      description: description || null,
      api_provider: api_provider || 'doubao',
      primary_model_id: primary_model_id || null,
      fallback_model_id: fallback_model_id || null,
    });

    const agent = agentRepository.getById(id);
    res.status(201).json({ success: true, data: parseAgentTags(agent!) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create agent' });
  }
});

// 预设Agent的测试输入提示词
const PRESET_TEST_INPUTS: Record<string, string> = {
  '告警处理Agent': '服务器CPU使用率异常，当前92%，阈值80%，请分析并提供处理建议',
  '故障诊断Agent': '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  '日志分析Agent': '系统日志中有多个错误记录，请分析并找出问题根源',
  '系统巡检Agent': '请执行系统健康检查，检查CPU、内存、磁盘、网络状况',
  '变更执行Agent': '请执行Nginx服务重启操作',
  '文档生成Agent': '请生成今天的系统运维报告',
  '合规检查Agent': '请执行安全合规检查，验证系统配置是否符合安全标准',
  '服务器命令执行Agent': '请检查服务器磁盘使用情况',
  '自动巡检Agent': '请对所有服务器执行批量巡检',
};

// 测试Agent执行
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { input, serverId, serverIds, context, databaseId } = req.body;
    const agent = agentRepository.getById(req.params.id);

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
      serverIds: serverIds && serverIds.length > 0 ? serverIds : (serverId ? [serverId] : undefined),
      databaseId: databaseId || undefined
    };

    try {
      // 检查是否是服务器相关Agent或数据库运维Agent，如果是，就用增强的执行器
      if (agentName.includes('服务器') || agentName.includes('巡检') || agentName.includes('数据库运维')) {
        output = await executeAgentNode(agent.id, input, executionContext);
      } else {
        // 其他Agent用LLM执行
        output = await executeAgentWithLLM(agent.id, input);
      }
    } catch (error) {
      status = 'error';
      errorMessage = (error as Error).message;
      output = `Agent "${agentName}" 执行失败: ${errorMessage}`;
    }

    const executionTime = Date.now() - startTime;

    // 保存执行记录
    agentExecutionRepository.create({
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
    agentRepository.incrementUsageStats(req.params.id);

    res.json({
      success: true,
      data: {
        executionId,
        output,
        status,
        executionTime,
        metadata: {
          serverId,
          databaseId
        }
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to test agent' });
  }
});

// 获取Agent的推荐测试输入
router.get('/:id/test-input', (req: Request, res: Response) => {
  try {
    const agent = agentRepository.getNameRoleCategory(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const agentName = agent.name;
    let testInput = PRESET_TEST_INPUTS[agentName];

    // 如果没有预设的测试输入，生成一个通用的
    if (!testInput) {
      const role = agent.role || '运维助手';
      testInput = `你好，我是${role}，帮助我处理一个运维相关的问题`;
    }

    res.json({
      success: true,
      data: {
        testInput,
        agentName
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get test input' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, avatar, role, system_prompt, model, temperature, enabled, category, tags, description, api_provider, primary_model_id, fallback_model_id } = req.body;

    agentRepository.update(req.params.id, {
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

    const agent = agentRepository.getById(req.params.id);
    res.json({ success: true, data: parseAgentTags(agent!) });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const agent = agentRepository.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    agentRepository.delete(req.params.id);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete agent' });
  }
});

router.post('/import', (req: Request, res: Response) => {
  try {
    const agents = req.body.agents;
    if (!Array.isArray(agents)) {
      return res.status(400).json({ success: false, error: 'Invalid format: agents must be an array' });
    }

    const imported: string[] = [];
    for (const agent of agents) {
      const id = randomUUID();
      agentRepository.create({
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

    res.status(201).json({ success: true, data: { importedCount: imported.length, ids: imported } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import agents' });
  }
});

router.get('/export/:id', (req: Request, res: Response) => {
  try {
    const agent = agentRepository.getById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const { id: _id, created_at: _created_at, updated_at: _updated_at, is_preset: _is_preset, usage_count: _usage_count, last_used_at: _last_used_at, ...exportData } = agent;
    const finalData = {
      ...exportData,
      tags: exportData.tags ? JSON.parse(exportData.tags) : []
    };
    res.json({ success: true, data: finalData });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export agent' });
  }
});

// ==================== 工具管理 API ====================

// 获取所有工具
router.get('/tools/list', (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let tools;

    if (category) {
      tools = agentToolRegistry.listToolsByCategory(category as never);
    } else {
      tools = agentToolRegistry.listTools();
    }

    // 简化工具信息，避免暴露内部实现
    const simplifiedTools = tools.map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      schema: tool.schema,
    }));

    res.json({
      success: true,
      data: simplifiedTools,
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get tools' });
  }
});

// 测试工具执行
router.post('/tools/test', async (req: Request, res: Response) => {
  try {
    const { toolId, args } = req.body;

    if (!toolId) {
      return res.status(400).json({ success: false, error: 'Tool ID is required' });
    }

    const tool = agentToolRegistry.getTool(toolId);
    if (!tool) {
      return res.status(404).json({ success: false, error: `Tool ${toolId} not found` });
    }

    const result = await tool.execute(args || {});

    res.json({
      success: true,
      data: {
        toolId,
        args,
        result,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to execute tool' });
  }
});

// 获取工具的描述（给 LLM 用的格式）
router.get('/tools/descriptions', (_req: Request, res: Response) => {
  try {
    const descriptions = agentToolRegistry.generateToolDescriptions();
    res.json({
      success: true,
      data: {
        description: descriptions,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get tool descriptions' });
  }
});

// 注意：测试未保存 Agent 配置需要先保存 Agent
// 推荐流程：先创建 Agent，再测试执行

export default router;
