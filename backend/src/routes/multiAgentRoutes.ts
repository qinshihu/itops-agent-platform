import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { MultiAgentOrchestrator } from '../services/multiAgentCollaboration';
import EnhancedRAGService from '../services/enhancedRAGService';
import db, { getIOInstance } from '../models/database';
import { emitToTask } from '../websocket/handler';
import { logger } from '../utils/logger';

const router = Router();
const ragService = new EnhancedRAGService();

// 预设协作模板
const PRESET_COLLABORATION_TEMPLATES = [
  {
    id: 'troubleshooting',
    name: '故障诊断协作',
    description: '多个专家Agent协作进行复杂故障定位',
    agentRoles: ['告警处理', '故障诊断', '日志分析', '系统巡检'],
    workflow: '告警分析 → 故障定位 → 日志排查 → 健康检查',
    category: '故障处理'
  },
  {
    id: 'system_check',
    name: '系统健康检查',
    description: '全面检查系统健康状态和安全合规',
    agentRoles: ['系统巡检', '合规检查', '服务器命令执行'],
    workflow: '硬件检查 → 服务状态 → 安全审计 → 综合报告',
    category: '巡检审计'
  },
  {
    id: 'incident_response',
    name: '事件响应流程',
    description: '标准化的IT事件响应处理流程',
    agentRoles: ['告警处理', '故障诊断', '变更执行', '文档生成'],
    workflow: '接收告警 → 分析影响 → 执行修复 → 记录归档',
    category: '事件响应'
  },
  {
    id: 'knowledge_enhanced',
    name: '知识增强分析',
    description: '结合知识库进行深度问题分析',
    agentRoles: ['知识检索', '任意业务Agent'],
    workflow: '知识检索 → 上下文注入 → 智能分析 → 方案生成',
    category: '知识管理'
  }
];

/**
 * 启动多Agent协作
 */
router.post('/collaborate', async (req: Request, res: Response) => {
  try {
    const {
      query,
      agentIds,
      options = {}
    } = req.body;

    if (!query || !agentIds || agentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'query和agentIds参数必填'
      });
    }

    const taskId = randomUUID();
    const orchestrator = new MultiAgentOrchestrator(taskId, options);

    // 开始协作（异步）
    res.json({
      success: true,
      data: {
        taskId,
        status: 'started',
        message: '多Agent协作已开始'
      }
    });

    // 后台执行协作
    try {
      const result = await orchestrator.collaborate(query, agentIds, options);
      
      // 保存协作结果到任务记录
      db.prepare(`
        INSERT INTO tasks (id, name, status, node_results, created_at)
        VALUES (?, ?, ?, ?, datetime('now','localtime'))
      `).run(
        taskId,
        `多Agent协作: ${query.substring(0, 50)}...`,
        'completed',
        JSON.stringify({ conversation: result })
      );

      const io = getIOInstance();
      emitToTask(io!, taskId, 'task:completed', {
        status: 'completed',
        result: result,
        timestamp: new Date().toISOString()
      });

      // 可选：保存到知识库
      if (options.saveToKnowledge) {
        await orchestrator.saveToKnowledgeBase(
          `协作案例: ${query.substring(0, 30)}...`,
          '协作案例'
        );
      }

    } catch (executionError) {
      logger.error('协作执行失败:', executionError);
      const io = getIOInstance();
      emitToTask(io!, taskId, 'task:error', {
        status: 'failed',
        error: executionError instanceof Error ? executionError.message : String(executionError),
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('启动协作失败:', error);
    res.status(500).json({
      success: false,
      error: '启动协作失败'
    });
  }
});

/**
 * 获取协作模板
 */
router.get('/templates', (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: PRESET_COLLABORATION_TEMPLATES
    });
  } catch {
    res.status(500).json({
      success: false,
      error: '获取模板失败'
    });
  }
});

/**
 * 根据模板快速创建协作
 */
router.post('/collaborate/from-template', async (req: Request, res: Response) => {
  try {
    const { templateId, query, extraAgentIds = [] } = req.body;
    
    const template = PRESET_COLLABORATION_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在'
      });
    }

    // 查找匹配的Agent
    const matchingAgents = db.prepare(`
      SELECT id, name, role FROM agents 
      WHERE enabled = 1 AND (
        ${template.agentRoles.map(() => 'category = ? OR role LIKE ?').join(' OR ')}
      )
    `).all(
      ...template.agentRoles.flatMap(role => [role, `%${role}%`])
    ) as Array<Record<string, unknown>>;

    const agentIds = [
      ...matchingAgents.map(a => a.id),
      ...extraAgentIds
    ].filter((id, index, arr) => arr.indexOf(id) === index); // 去重

    if (agentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有找到匹配的Agent，请先配置Agent'
      });
    }

    // 调用协作API
    const taskId = randomUUID();
    const orchestrator = new MultiAgentOrchestrator(taskId);

    res.json({
      success: true,
      data: {
        taskId,
        templateId,
        agentIds,
        matchingAgents,
        status: 'started'
      }
    });

    // 后台执行
    try {
      await orchestrator.collaborate(query, agentIds);
      const io = getIOInstance();
      emitToTask(io!, taskId, 'task:completed', {
        status: 'completed',
        templateId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('模板协作执行失败:', error);
      const io = getIOInstance();
      emitToTask(io!, taskId, 'task:error', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        templateId,
        timestamp: new Date().toISOString()
      });
    }

  } catch {
    res.status(500).json({
      success: false,
      error: '创建协作失败'
    });
  }
});

// ========== 增强的RAG知识库API ==========

/**
 * 智能搜索知识库
 */
router.get('/knowledge/search', async (req: Request, res: Response) => {
  try {
    const { q, category, limit = 10, minScore = 0.1 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词必填'
      });
    }

    const results = await ragService.search(q as string, {
      category: category as string,
      limit: parseInt(limit as string),
      minScore: parseFloat(minScore as string)
    });

    res.json({
      success: true,
      data: {
        query: q,
        results,
        total: results.length
      }
    });
  } catch (error) {
    logger.error('搜索失败:', error);
    res.status(500).json({
      success: false,
      error: '搜索失败'
    });
  }
});

/**
 * 获取知识注入提示词（用于增强Agent）
 */
router.post('/knowledge/inject', async (req: Request, res: Response) => {
  try {
    const { query, category, maxItems, minScore } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: '查询内容必填'
      });
    }

    const result = await ragService.injectKnowledge(query, {
      category,
      maxItems,
      minScore
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('知识注入失败:', error);
    res.status(500).json({
      success: false,
      error: '知识注入失败'
    });
  }
});

/**
 * 添加知识
 */
router.post('/knowledge', async (req: Request, res: Response) => {
  try {
    const { title, content, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '标题和内容必填'
      });
    }

    const id = await ragService.addKnowledge(title, content, category, tags);

    res.status(201).json({
      success: true,
      data: { id, title, category }
    });
  } catch (error) {
    logger.error('添加知识失败:', error);
    res.status(500).json({
      success: false,
      error: '添加知识失败'
    });
  }
});

/**
 * 批量导入知识
 */
router.post('/knowledge/batch', async (req: Request, res: Response) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'items参数必须是数组'
      });
    }

    const result = await ragService.batchImport(items);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('批量导入失败:', error);
    res.status(500).json({
      success: false,
      error: '批量导入失败'
    });
  }
});

/**
 * 获取相似知识
 */
router.get('/knowledge/:id/similar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    const similarItems = await ragService.getSimilarKnowledge(
      id,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: {
        sourceId: id,
        similarItems
      }
    });
  } catch (error) {
    logger.error('获取相似知识失败:', error);
    res.status(500).json({
      success: false,
      error: '获取相似知识失败'
    });
  }
});

/**
 * 获取知识库统计
 */
router.get('/knowledge/statistics', (_req: Request, res: Response) => {
  try {
    const statistics = ragService.getStatistics();
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('获取统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取统计失败'
    });
  }
});

/**
 * 获取Agent协作历史记录
 */
router.get('/history', (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const history = db.prepare(`
      SELECT id, name, status, created_at 
      FROM tasks 
      WHERE name LIKE '%多Agent协作%' 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(parseInt(limit as string), parseInt(offset as string));

    res.json({
      success: true,
      data: history
    });
  } catch {
    res.status(500).json({
      success: false,
      error: '获取历史记录失败'
    });
  }
});

export default router;