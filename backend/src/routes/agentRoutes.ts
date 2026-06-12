import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { executeAgentWithLLM } from '../services/llmService';
import { executeAgentNode } from '../services/agentExecutor';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { category, enabled, search } = req.query;
    let query = `
      SELECT a.*, 
        pm.name as primary_model_name,
        fm.name as fallback_model_name
      FROM agents a
      LEFT JOIN ai_models pm ON a.primary_model_id = pm.id
      LEFT JOIN ai_models fm ON a.fallback_model_id = fm.id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    
    if (category) {
      query += ' AND a.category = ?';
      params.push(category);
    }
    if (enabled !== undefined) {
      query += ' AND a.enabled = ?';
      params.push(enabled === 'true' ? 1 : 0);
    }
    if (search) {
      query += ' AND (a.name LIKE ? OR a.role LIKE ? OR a.description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY a.is_preset DESC, a.usage_count DESC, a.created_at DESC';
    
    const agents = db.prepare(query).all(...params);
    // 解析tags字段
    const processedAgents = (agents as Array<{ id: string; tags?: string; [key: string]: unknown }>).map(agent => ({
      ...agent,
      tags: agent.tags ? JSON.parse(agent.tags) : []
    }));
    res.json({ success: true, data: processedAgents });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agents' });
  }
});

// 获取Agent统计信息
router.get('/stats/summary', (_req: Request, res: Response) => {
  try {
    const totalAgents = (db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number }).count;
    const enabledAgents = (db.prepare('SELECT COUNT(*) as count FROM agents WHERE enabled = 1').get() as { count: number }).count;
    const presetAgents = (db.prepare('SELECT COUNT(*) as count FROM agents WHERE is_preset = 1').get() as { count: number }).count;
    const totalExecutions = (db.prepare('SELECT COUNT(*) as count FROM agent_executions').get() as { count: number }).count;
    
    // 获取分类统计
    const categoryStats = db.prepare(`
      SELECT category, COUNT(*) as count 
      FROM agents 
      WHERE category IS NOT NULL 
      GROUP BY category
    `).all();
    
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
    const agent = db.prepare(`
      SELECT a.*, 
        pm.name as primary_model_name,
        fm.name as fallback_model_name
      FROM agents a
      LEFT JOIN ai_models pm ON a.primary_model_id = pm.id
      LEFT JOIN ai_models fm ON a.fallback_model_id = fm.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    const processedAgent = { ...(agent as { id: string; name: string; role: string; tags?: string; [key: string]: unknown }), tags: (agent as { tags?: string })?.tags ? JSON.parse((agent as { tags?: string }).tags!) : [] };
    res.json({ success: true, data: processedAgent });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch agent' });
  }
});

// 获取Agent执行历史
router.get('/:id/executions', (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, status } = req.query;
    let query = 'SELECT * FROM agent_executions WHERE agent_id = ?';
    const params: unknown[] = [req.params.id];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const executions = db.prepare(query).all(...params);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as count FROM agent_executions WHERE agent_id = ?';
    const countParams: unknown[] = [req.params.id];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const totalCount = (db.prepare(countQuery).get(...countParams) as { count: number }).count;
    
    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          total: totalCount,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
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
    
    db.prepare(`
      INSERT INTO agents (id, name, avatar, role, system_prompt, model, temperature, enabled, is_preset, category, tags, description, api_provider, primary_model_id, fallback_model_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, 
      name, 
      avatar, 
      role, 
      system_prompt, 
      model || 'doubao-4o', 
      temperature || 0.7, 
      enabled !== false ? 1 : 0, 
      0, 
      category || null, 
      tags ? JSON.stringify(tags) : null,
      description || null,
      api_provider || 'doubao',
      primary_model_id || null,
      fallback_model_id || null
    );
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    const processedAgent = { ...(agent as { id: string; name: string; role: string; tags?: string; [key: string]: unknown }), tags: (agent as { tags?: string })?.tags ? JSON.parse((agent as { tags?: string }).tags!) : [] };
    res.status(201).json({ success: true, data: processedAgent });
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
    const { input, serverId, serverIds, context } = req.body;
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    const executionId = randomUUID();
    const startTime = Date.now();
    const agentName = (agent as { name: string }).name;
    
    let output = '';
    let status = 'success';
    let errorMessage = null;
    
    // 构建上下文 - 优先使用serverIds，如果没有则使用serverId
    const executionContext = {
      ...context,
      serverIds: serverIds && serverIds.length > 0 ? serverIds : (serverId ? [serverId] : undefined)
    };
    
    try {
      // 检查是否是服务器相关的Agent，如果是，就用增强的执行器
      if (agentName.includes('服务器') || agentName.includes('巡检')) {
        output = await executeAgentNode((agent as { id: string }).id, input, executionContext);
      } else {
        // 其他Agent用LLM执行
        output = await executeAgentWithLLM((agent as { id: string }).id, input);
      }
    } catch (error) {
      status = 'error';
      errorMessage = (error as Error).message;
      output = `Agent "${agentName}" 执行失败: ${errorMessage}`;
    }
    
    const executionTime = Date.now() - startTime;
    
    // 保存执行记录
    db.prepare(`
      INSERT INTO agent_executions (id, agent_id, agent_name, input_text, output_text, status, error_message, execution_time_ms, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      executionId,
      req.params.id,
      (agent as { name: string }).name,
      input,
      output,
      status,
      errorMessage,
      executionTime,
      JSON.stringify({ test: true, context: executionContext, serverId, serverIds })
    );
    
    // 更新Agent使用统计
    db.prepare(`
      UPDATE agents 
      SET usage_count = usage_count + 1, 
          last_used_at = datetime('now','localtime'),
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(req.params.id);
    
    res.json({
      success: true,
      data: {
        executionId,
        output,
        status,
        executionTime,
        metadata: {
          serverId
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
    const agent = db.prepare('SELECT name, role, category FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    const agentName = (agent as { name: string }).name;
    let testInput = PRESET_TEST_INPUTS[agentName];
    
    // 如果没有预设的测试输入，生成一个通用的
    if (!testInput) {
      const role = (agent as { role?: string }).role || '运维助手';
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
    
    db.prepare(`
      UPDATE agents 
      SET name = ?, avatar = ?, role = ?, system_prompt = ?, 
          model = ?, temperature = ?, enabled = ?, 
          category = ?, tags = ?, description = ?, api_provider = ?,
          primary_model_id = ?, fallback_model_id = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      name, avatar, role, system_prompt, 
      model, temperature, enabled ? 1 : 0, 
      category || null, tags ? JSON.stringify(tags) : null, 
      description || null, api_provider || 'doubao',
      primary_model_id || null, fallback_model_id || null,
      req.params.id
    );
    
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    const processedAgent = { ...(agent as { id: string; name: string; role: string; tags?: string; [key: string]: unknown }), tags: (agent as { tags?: string })?.tags ? JSON.parse((agent as { tags?: string }).tags!) : [] };
    res.json({ success: true, data: processedAgent });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
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
    
    const insertStmt = db.prepare(`
      INSERT INTO agents (id, name, avatar, role, system_prompt, model, temperature, enabled, is_preset, category, tags, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const imported = [];
    for (const agent of agents) {
      const id = randomUUID();
      insertStmt.run(
        id,
        agent.name,
        agent.avatar,
        agent.role,
        agent.system_prompt,
        agent.model || 'doubao-4o',
        agent.temperature || 0.7,
        agent.enabled !== false ? 1 : 0,
        0,
        agent.category || null,
        agent.tags ? JSON.stringify(agent.tags) : null,
        agent.description || null
      );
      imported.push(id);
    }
    
    res.status(201).json({ success: true, data: { importedCount: imported.length, ids: imported } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to import agents' });
  }
});

router.get('/export/:id', (req: Request, res: Response) => {
  try {
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    
    const { id: _id, created_at: _created_at, updated_at: _updated_at, is_preset: _is_preset, usage_count: _usage_count, last_used_at: _last_used_at, ...exportData } = agent as { id: string; created_at: string; updated_at: string; is_preset: number; usage_count: number; last_used_at: string; tags?: string; [key: string]: unknown };
    const finalData = {
      ...exportData,
      tags: exportData.tags ? JSON.parse(exportData.tags) : []
    };
    res.json({ success: true, data: finalData });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export agent' });
  }
});

// 注意：测试未保存�?Agent 配置需要先保存 Agent
// 推荐流程：先创建 Agent，再测试执行

export default router;
