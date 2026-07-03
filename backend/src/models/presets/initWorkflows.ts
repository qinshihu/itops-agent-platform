import db from '../database';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export function initializePresetWorkflows() {
  const alertAgent = db.prepare("SELECT id FROM agents WHERE name = '告警处理 Agent'").get() as { id: string } | undefined;
  const diagnosticAgent = db.prepare("SELECT id FROM agents WHERE name = '故障诊断 Agent'").get() as { id: string } | undefined;
  const logAgent = db.prepare("SELECT id FROM agents WHERE name = '日志分析 Agent'").get() as { id: string } | undefined;
  const systemCheckAgent = db.prepare("SELECT id FROM agents WHERE name = '系统巡检 Agent'").get() as { id: string } | undefined;
  const changeAgent = db.prepare("SELECT id FROM agents WHERE name = '变更执行 Agent'").get() as { id: string } | undefined;
  const docAgent = db.prepare("SELECT id FROM agents WHERE name = '文档生成 Agent'").get() as { id: string } | undefined;
  const complianceAgent = db.prepare("SELECT id FROM agents WHERE name = '合规检查 Agent'").get() as { id: string } | undefined;
  const commandAgent = db.prepare("SELECT id FROM agents WHERE name = '服务器命令执行 Agent'").get() as { id: string } | undefined;

  const healthNode1 = randomUUID();
  const healthNode2 = randomUUID();
  const healthNode3 = randomUUID();
  
  const dailyHealthCheckNodes = JSON.stringify([
    { id: healthNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '系统巡检 Agent', agentId: systemCheckAgent?.id || null, avatar: '🔎' } },
    { id: healthNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '服务器命令执行 Agent', agentId: commandAgent?.id || null, avatar: '💻' } },
    { id: healthNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const dailyHealthCheckEdges = JSON.stringify([
    { id: randomUUID(), source: healthNode1, target: healthNode2 },
    { id: randomUUID(), source: healthNode2, target: healthNode3 }
  ]);

  const alertNode1 = randomUUID();
  const alertNode2 = randomUUID();
  const alertNode3 = randomUUID();
  
  const alertHandlingNodes = JSON.stringify([
    { id: alertNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '告警处理 Agent', agentId: alertAgent?.id || null, avatar: '🚨' } },
    { id: alertNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '日志分析 Agent', agentId: logAgent?.id || null, avatar: '📝' } },
    { id: alertNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const alertHandlingEdges = JSON.stringify([
    { id: randomUUID(), source: alertNode1, target: alertNode2 },
    { id: randomUUID(), source: alertNode2, target: alertNode3 }
  ]);

  const diagNode1 = randomUUID();
  const diagNode2 = randomUUID();
  const diagNode3 = randomUUID();
  const diagNode4 = randomUUID();
  
  const diagnosticNodes = JSON.stringify([
    { id: diagNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '故障诊断 Agent', agentId: diagnosticAgent?.id || null, avatar: '🔍' } },
    { id: diagNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '日志分析 Agent', agentId: logAgent?.id || null, avatar: '📝' } },
    { id: diagNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '服务器命令执行 Agent', agentId: commandAgent?.id || null, avatar: '💻' } },
    { id: diagNode4, type: 'agent', position: { x: 1000, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const diagnosticEdges = JSON.stringify([
    { id: randomUUID(), source: diagNode1, target: diagNode2 },
    { id: randomUUID(), source: diagNode2, target: diagNode3 },
    { id: randomUUID(), source: diagNode3, target: diagNode4 }
  ]);

  const compNode1 = randomUUID();
  const compNode2 = randomUUID();
  const compNode3 = randomUUID();
  
  const complianceNodes = JSON.stringify([
    { id: compNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '合规检查 Agent', agentId: complianceAgent?.id || null, avatar: '🛡️' } },
    { id: compNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '服务器命令执行 Agent', agentId: commandAgent?.id || null, avatar: '💻' } },
    { id: compNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const complianceEdges = JSON.stringify([
    { id: randomUUID(), source: compNode1, target: compNode2 },
    { id: randomUUID(), source: compNode2, target: compNode3 }
  ]);

  const changeNode1 = randomUUID();
  const changeNode2 = randomUUID();
  const changeNode3 = randomUUID();
  
  const changeNodes = JSON.stringify([
    { id: changeNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '变更执行 Agent', agentId: changeAgent?.id || null, avatar: '⚙️' } },
    { id: changeNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '服务器命令执行 Agent', agentId: commandAgent?.id || null, avatar: '💻' } },
    { id: changeNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const changeEdges = JSON.stringify([
    { id: randomUUID(), source: changeNode1, target: changeNode2 },
    { id: randomUUID(), source: changeNode2, target: changeNode3 }
  ]);

  const logNode1 = randomUUID();
  const logNode2 = randomUUID();
  const logNode3 = randomUUID();
  
  const logAnalysisNodes = JSON.stringify([
    { id: logNode1, type: 'agent', position: { x: 100, y: 100 }, data: { label: '日志分析 Agent', agentId: logAgent?.id || null, avatar: '📝' } },
    { id: logNode2, type: 'agent', position: { x: 400, y: 100 }, data: { label: '服务器命令执行 Agent', agentId: commandAgent?.id || null, avatar: '💻' } },
    { id: logNode3, type: 'agent', position: { x: 700, y: 100 }, data: { label: '文档生成 Agent', agentId: docAgent?.id || null, avatar: '📄' } }
  ]);
  
  const logAnalysisEdges = JSON.stringify([
    { id: randomUUID(), source: logNode1, target: logNode2 },
    { id: randomUUID(), source: logNode2, target: logNode3 }
  ]);
  
  const presetWorkflows = [
    {
      id: randomUUID(),
      name: '日常健康检查',
      description: '对服务器进行日常健康检查，包括系统巡检、命令执行和报告生成',
      nodes: dailyHealthCheckNodes,
      edges: dailyHealthCheckEdges,
      is_template: 1
    },
    {
      id: randomUUID(),
      name: '告警处理',
      description: '处理系统告警，分析告警信息，检查日志并生成处理报告',
      nodes: alertHandlingNodes,
      edges: alertHandlingEdges,
      is_template: 1
    },
    {
      id: randomUUID(),
      name: '故障诊断',
      description: '对系统故障进行全面诊断，分析症状、检查日志、执行命令并生成诊断报告',
      nodes: diagnosticNodes,
      edges: diagnosticEdges,
      is_template: 1
    },
    {
      id: randomUUID(),
      name: '合规检查',
      description: '验证服务器配置是否符合安全基线和合规要求，生成合规检查报告',
      nodes: complianceNodes,
      edges: complianceEdges,
      is_template: 1
    },
    {
      id: randomUUID(),
      name: '变更执行',
      description: '执行系统变更操作，验证操作结果，生成变更执行报告',
      nodes: changeNodes,
      edges: changeEdges,
      is_template: 1
    },
    {
      id: randomUUID(),
      name: '日志分析',
      description: '分析系统和应用日志，识别错误模式和异常事件，生成分析报告',
      nodes: logAnalysisNodes,
      edges: logAnalysisEdges,
      is_template: 1
    }
  ];

  const insertWorkflow = db.prepare(`
    INSERT OR IGNORE INTO workflows (id, name, description, nodes, edges, is_template)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  presetWorkflows.forEach(workflow => {
    insertWorkflow.run(workflow.id, workflow.name, workflow.description, workflow.nodes, workflow.edges, workflow.is_template);
  });

  logger.info(`✅ 成功创建 ${presetWorkflows.length} 个预设工作流`);
}
