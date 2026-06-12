import { randomUUID } from 'crypto';
import db, { getIOInstance } from '../models/database';
import { logger } from '../utils/logger';
import { executeAgentNode, getThinkingSteps } from './agentExecutor';
import { reportService } from './reportService';
import {
  WorkflowNode,
  WorkflowEdge,
  NodeResult,
  TaskLogEntry,
  WorkflowParsed
} from '../types';

function calculateTextSimilarity(text1: string, text2: string): number {
  const set1 = new Set(text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const set2 = new Set(text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

function isDuplicateKnowledgeBase(content: string, similarityThreshold: number = 0.7): string | null {
  try {
    const existing = db.prepare('SELECT id, content FROM knowledge_base WHERE category = ? ORDER BY created_at DESC LIMIT 50').all('故障处理') as Array<{ id: string; content: string }>;
    const targetError = content.toLowerCase();
    
    for (const entry of existing) {
      const similarity = calculateTextSimilarity(targetError, entry.content.toLowerCase());
      if (similarity >= similarityThreshold) {
        return entry.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface ExecutionVariable {
  name: string;
  value: unknown;
}

interface ExecutionContext {
  variables: Record<string, unknown>;
  previousResults: Array<{ nodeId: string; status: string; output?: string; error?: string }>;
  metadata: {
    taskId: string;
    workflowName: string;
    currentNodeId?: string;
    executionDepth: number;
    startTime: string;
  };
}

export async function executeWorkflow(
  taskId: string,
  workflow: WorkflowParsed,
  initialInput?: string,
  context?: Record<string, unknown>
) {
  const io = getIOInstance();
  const MAX_EXECUTION_DEPTH = 50;
  let executionDepth = 0;
  const nodeResults: Record<string, NodeResult> = {};
  let nodes: WorkflowNode[] = [];
  let executionOrder: string[] = [];
  const startTime = new Date().toISOString();
  const executionContext: ExecutionContext = {
    variables: context ? { ...context } : {},
    previousResults: [],
    metadata: {
      taskId,
      workflowName: workflow.name,
      executionDepth: 0,
      startTime
    }
  };
  
  try {
    logger.info('🔄 Starting workflow execution:', { taskId, workflowName: workflow.name, context });
    
    nodes = Array.isArray(workflow.nodes) ? workflow.nodes : JSON.parse(workflow.nodes as unknown as string || '[]') as WorkflowNode[];
    const edges = Array.isArray(workflow.edges) ? workflow.edges : JSON.parse(workflow.edges as unknown as string || '[]') as WorkflowEdge[];
    executionOrder = topologicalSort(nodes, edges);
    
    if (executionOrder.length === 0) {
      logger.error(`❌ Workflow ${workflow.name} has circular dependencies, aborting execution`);
      db.prepare('UPDATE tasks SET status = ?, end_time = datetime(\'now\',\'localtime\') WHERE id = ?')
        .run('failed', taskId);
      io?.to(`task:${taskId}`).emit('task:failed', { taskId, error: 'Circular dependency detected in workflow' });
      return;
    }
    
    logger.info('📊 Parsed workflow nodes:', nodes);
    logger.info('📊 Execution order:', executionOrder);
    
    db.prepare('UPDATE tasks SET status = ?, start_time = datetime(\'now\',\'localtime\'), execution_order = ? WHERE id = ?')
      .run('running', JSON.stringify(executionOrder), taskId);
    
    io?.to(`task:${taskId}`).emit('task:started', { taskId, executionOrder });
    
    for (const nodeId of executionOrder) {
      if (executionDepth++ >= MAX_EXECUTION_DEPTH) {
        logger.error(`❌ Workflow ${workflow.name} exceeded maximum execution depth`);
        break;
      }
      const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
      if (task?.status === 'cancelled') {
        break;
      }
      
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.type !== 'agent') continue;
      
      logger.info(`🤖 Processing node ${nodeId}:`, node.data);
      
      io?.to(`task:${taskId}`).emit('task:node:started', {
        nodeId,
        nodeName: node.data.label
      });
      
      try {
        const previousResults = Object.values(nodeResults).map((r) => r.output).filter(Boolean).join('\n\n');
        const input = previousResults || initialInput || '请开始执行任务';
        
        executionContext.metadata.currentNodeId = nodeId;
        executionContext.metadata.executionDepth = executionDepth;
        executionContext.previousResults.push({
          nodeId,
          status: 'running',
          output: undefined,
          error: undefined
        });
        
        // 显示思考进度
        const thinkingProcess = getThinkingSteps(node.data.label);
        for (const step of thinkingProcess) {
          await delay(300);
          io?.to(`task:${taskId}`).emit('task:node:thinking', {
            taskId,
            nodeId,
            content: step
          });
          addTaskLog(taskId, { type: 'thinking', content: step, nodeId });
        }
        
        logger.info(`🤖 Calling executeAgentNode with agentId: ${node.data.agentId} context:`, context);
        const output = await executeAgentNode(node.data.agentId, input, context);
        
        nodeResults[nodeId] = {
          status: 'success',
          output,
          metadata: {
            thinkingProcess: thinkingProcess.join('\n'),
            executionTime: Date.now()
          }
        };
        
        const lastResultIdx = executionContext.previousResults.findIndex(r => r.nodeId === nodeId && r.status === 'running');
        if (lastResultIdx !== -1) {
          executionContext.previousResults[lastResultIdx] = {
            nodeId,
            status: 'success',
            output
          };
        }
        
        io?.to(`task:${taskId}`).emit('task:node:output', {
          taskId,
          nodeId,
          output
        });
        
        io?.to(`task:${taskId}`).emit('task:node:completed', {
          taskId,
          nodeId,
          status: 'success',
          output
        });
        
        addTaskLog(taskId, { type: 'output', content: output, nodeId });
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        nodeResults[nodeId] = {
          status: 'failed',
          error: errorMessage
        };
        
        io?.to(`task:${taskId}`).emit('task:node:completed', {
          taskId,
          nodeId,
          status: 'failed',
          error: errorMessage
        });
        
        addTaskLog(taskId, { type: 'error', content: errorMessage, nodeId });
        
        if (!node.data.allowFailure) {
          throw error;
        }
      }
    }
    
    db.prepare(`
      UPDATE tasks 
      SET status = ?, end_time = datetime('now','localtime'), 
          node_results = ?, current_node_id = NULL
      WHERE id = ?
    `).run('completed', JSON.stringify(nodeResults), taskId);
    
    try {
      const failedNodes = Object.entries(nodeResults)
        .filter(([_, result]) => result.status === 'failed')
        .map(([nodeId, result]) => {
          const node = nodes.find((n) => n.id === nodeId);
          return { ...result, nodeId, node };
        });
      
      if (failedNodes.length > 0) {
        failedNodes.forEach((nodeResult) => {
          const title = `${workflow.name} - 故障案例`;
          const content = `**故障节点**: ${nodeResult.node?.data?.label || nodeResult.nodeId}\n**错误**: ${nodeResult.error}\n**分析时间**: ${new Date().toISOString()}`;
          
          const duplicateId = isDuplicateKnowledgeBase(content);
          if (duplicateId) {
            logger.info(`ℹ️ 跳过重复的故障案例，已存在相似条目: ${duplicateId}`);
            return;
          }
          
          db.prepare(`
            INSERT INTO knowledge_base (id, title, category, content, created_at)
            VALUES (?, ?, ?, ?, datetime('now','localtime'))
          `).run(randomUUID(), title, '故障处理', content);
        });
        
        logger.info('✅ 故障案例已自动存入知识库');
      }
    } catch (insertError) {
      logger.error('Failed to insert into knowledge_base:', insertError);
    }

    try {
      await generateWorkflowExecutionReport(taskId, workflow, nodes, nodeResults, executionOrder, 'completed');
    } catch (reportError) {
      logger.error('Failed to generate workflow report:', reportError);
    }
    
    io?.to(`task:${taskId}`).emit('task:completed', {
      taskId,
      status: 'completed',
      nodeResults
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    db.prepare(`
      UPDATE tasks 
      SET status = ?, end_time = datetime('now','localtime'), current_node_id = NULL
      WHERE id = ?
    `).run('failed', taskId);
    
    try {
      await generateWorkflowExecutionReport(taskId, workflow, nodes, nodeResults, executionOrder, 'failed', errorMessage);
    } catch (reportError) {
      logger.error('Failed to generate workflow report (failed case):', reportError);
    }
    
    io?.to(`task:${taskId}`).emit('task:failed', {
      taskId,
      error: errorMessage
    });
  }
}

async function generateWorkflowExecutionReport(
  taskId: string,
  workflow: WorkflowParsed,
  nodes: WorkflowNode[],
  nodeResults: Record<string, NodeResult>,
  executionOrder: string[],
  status: 'completed' | 'failed',
  errorMessage?: string
) {
  logger.info('📄 开始生成工作流执行报告...');
  
  const templates = reportService.getTemplates();
  let workflowTemplate = templates.find(t => t.name.includes('工作流执行报告'));
  
  if (!workflowTemplate) {
    logger.info('📄 未找到工作流执行报告模板，正在创建...');
    workflowTemplate = reportService.createTemplate({
      name: '工作流执行报告',
      description: '工作流执行完成后自动生成的执行报告',
      type: 'inspection',
      content: `# 工作流执行报告\n\n## 基本信息\n- **工作流名称**: {{workflow_name}}\n- **执行任务ID**: {{task_id}}\n- **执行状态**: {{execution_status}}\n- **开始时间**: {{start_time}}\n- **结束时间**: {{end_time}}\n\n## 执行顺序\n{{execution_order}}\n\n## 节点执行详情\n{{node_details}}\n\n## 执行总结\n{{execution_summary}}\n\n{{error_section}}\n\n---\n报告生成时间: {{generated_time}}`,
      variables: ['workflow_name', 'task_id', 'execution_status', 'start_time', 'end_time', 'execution_order', 'node_details', 'execution_summary', 'error_section', 'generated_time'],
      is_preset: true
    });
    logger.info('✅ 工作流执行报告模板创建成功:', workflowTemplate.id);
  } else {
    logger.info('✅ 使用已存在的工作流执行报告模板:', workflowTemplate.id);
  }
  
  const task = db.prepare('SELECT start_time, end_time FROM tasks WHERE id = ?').get(taskId) as { start_time?: string; end_time?: string } | undefined;
  
  const executionOrderDesc = executionOrder.map((nodeId, index) => {
    const node = nodes.find(n => n.id === nodeId);
    const nodeResult = nodeResults[nodeId];
    const status = nodeResult?.status || 'pending';
    return `${index + 1}. ${node?.data?.label || nodeId} (${status})`;
  }).join('\n');
  
  const nodeDetails = executionOrder.map((nodeId, index) => {
    const node = nodes.find(n => n.id === nodeId);
    const nodeResult = nodeResults[nodeId];
    
    let detail = `### ${index + 1}. ${node?.data?.label || nodeId}\n`;
    detail += `- **状态**: ${nodeResult?.status || 'pending'}\n`;
    
    if (nodeResult?.output) {
      detail += `- **输出**: \n${nodeResult.output.substring(0, 500)}${nodeResult.output.length > 500 ? '...' : ''}\n`;
    }
    
    if (nodeResult?.error) {
      detail += `- **错误**: ${nodeResult.error}\n`;
    }
    
    return detail;
  }).join('\n\n');
  
  const successCount = Object.values(nodeResults).filter((r) => r.status === 'success').length;
  const failedCount = Object.values(nodeResults).filter((r) => r.status === 'failed').length;
  const totalCount = Object.keys(nodeResults).length;
  
  const executionSummary = `共执行 ${totalCount} 个节点，成功 ${successCount} 个，失败 ${failedCount} 个。`;
  
  let errorSection = '';
  if (status === 'failed' && errorMessage) {
    errorSection = `## 错误信息\n\n${errorMessage}`;
  }
  
  const variables: Record<string, string> = {
    workflow_name: workflow.name,
    task_id: taskId,
    execution_status: status === 'completed' ? '成功完成' : '执行失败',
    start_time: task?.start_time ? new Date(task.start_time).toLocaleString() : '-',
    end_time: task?.end_time ? new Date(task.end_time).toLocaleString() : '-',
    execution_order: executionOrderDesc,
    node_details: nodeDetails,
    execution_summary: executionSummary,
    error_section: errorSection,
    generated_time: new Date().toLocaleString()
  };
  
  try {
    logger.info('📄 正在使用报告服务生成报告...');
    const generatedReport = reportService.generateReport(workflowTemplate.id, variables, 'markdown');
    logger.info('✅ 报告已通过服务生成:', generatedReport.id);
    
    try {
      logger.info('📄 正在向 reports 表插入报告...');
      db.prepare(`
        INSERT INTO reports (id, name, content, format, task_id, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
      `).run(
        generatedReport.id,
        generatedReport.name,
        generatedReport.content,
        'markdown',
        taskId
      );
      
      logger.info('📄 正在更新 tasks 表的 report_id 字段...');
      db.prepare('UPDATE tasks SET report_id = ? WHERE id = ?').run(generatedReport.id, taskId);
      
      logger.info('✅ 工作流执行报告已生成并关联到任务:', generatedReport.id);
      
      const savedReport = db.prepare('SELECT * FROM reports WHERE id = ?').get(generatedReport.id);
      logger.info('✅ 验证：从数据库中读取到的报告:', savedReport ? '存在' : '不存在');
      
    } catch (e) {
      logger.error('❌ 报告关联失败:', e);
    }
  } catch (generateError) {
    logger.error('❌ 报告生成过程出错:', generateError);
  }
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });
  
  edges.forEach(edge => {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    adjacency.get(edge.source)?.push(edge.target);
  });
  
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  const getNodePosition = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    return { x: node?.position?.x || 0, y: node?.position?.y || 0 };
  };
  
  const queue: string[] = [];
  const startNodes = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId)
    .sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });
  
  queue.push(...startNodes);
  
  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    neighbors.sort((a, b) => {
      const posA = getNodePosition(a);
      const posB = getNodePosition(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      return posA.x - posB.x;
    });
    
    neighbors.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    });
  }
  
  const nodeIds = nodes.map(n => n.id);
  const unsortedNodes = nodeIds.filter(id => !result.includes(id));
  
  if (unsortedNodes.length > 0) {
    logger.warn(`⚠️ 工作流存在循环依赖，以下节点处于环中: ${unsortedNodes.join(', ')}`);
    return [];
  }
  
  return result;
}

function addTaskLog(taskId: string, log: TaskLogEntry) {
  db.prepare(`
    UPDATE tasks 
    SET logs = json_insert(IFNULL(logs, '[]'), '$[#]', json_object(
      'timestamp', datetime('now'),
      'type', ?,
      'content', ?,
      'nodeId', ?
    ))
    WHERE id = ?
  `).run(log.type, log.content, log.nodeId || null, taskId);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
