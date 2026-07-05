/**
 * 工作流节点注册表
 * 定义所有可用节点类型的元数据
 */
import { ENHANCED_NODE_TYPES } from './enhancedNodeTypes';

export interface WorkflowNodeTypeMeta {
  type: string;
  label: string;
  description: string;
  category: 'core' | 'execution' | 'verification' | 'decision' | 'knowledge';
  icon: string;
  defaultConfig: Record<string, string | number | boolean | string[] | object[] | object>;
}

const NODE_REGISTRY: WorkflowNodeTypeMeta[] = [
  // ── 核心节点 ──
  { type: 'start', label: '开始', description: '工作流起始节点', category: 'core', icon: 'play', defaultConfig: {} },
  { type: 'end', label: '结束', description: '工作流结束节点', category: 'core', icon: 'stop', defaultConfig: {} },

  // ── 执行节点 ──
  { type: 'agent', label: 'Agent 节点', description: '调用 AI Agent 执行任务', category: 'execution', icon: 'bot', defaultConfig: { agentId: '', input: '' } },
  { type: 'approval', label: '审批节点', description: '暂停等待人工审批', category: 'execution', icon: 'check-circle', defaultConfig: { approvalConfig: { description: '', timeout: 3600, approvers: ['admin'] } } },

  // ── 验证节点（从 AARS 移植） ──
  { type: 'verification', label: '验证节点', description: '5级验证门禁链：命令执行→服务健康→指标恢复→基线对比→影响评估', category: 'verification', icon: 'shield-check', defaultConfig: { gates: ['command_success', 'service_health', 'metric_recovery', 'impact_assessment'], timeout: 300000 } },

  // ── 决策节点（从 AARS 移植） ──
  { type: 'risk_assess', label: '风险评估', description: '三维风险量化评分：操作风险+紧迫度+置信度', category: 'decision', icon: 'chart-bar', defaultConfig: {} },
  { type: 'decision', label: '智能决策', description: '基于风险评估结果自动决策：自动执行/要求审批/升级人工/阻止', category: 'decision', icon: 'lightbulb', defaultConfig: { rules: [{ condition: 'risk_score <= 0.35', action: 'auto_execute', description: '低风险自动执行' }, { condition: 'risk_score <= 0.65', action: 'request_approval', description: '中风险需审批' }, { condition: 'risk_score > 0.65', action: 'escalate_to_human', description: '高风险升级人工' }] } },

  // ── 知识与回滚节点 ──
  { type: 'rollback', label: '回滚节点', description: '执行回滚命令，恢复系统到修复前状态', category: 'verification', icon: 'undo', defaultConfig: { commandTimeout: 30000 } },
  { type: 'knowledge', label: '知识沉淀', description: '将执行过程自动沉淀到知识库，支持去重', category: 'knowledge', icon: 'book-open', defaultConfig: { deduplicate: true } },
];

export function getNodeTypeMeta(type: string): WorkflowNodeTypeMeta | undefined {
  return NODE_REGISTRY.find(n => n.type === type);
}

export function getNodeTypesByCategory(category: WorkflowNodeTypeMeta['category']): WorkflowNodeTypeMeta[] {
  return NODE_REGISTRY.filter(n => n.category === category);
}

export function getAllNodeTypes(): WorkflowNodeTypeMeta[] {
  return [...NODE_REGISTRY];
}

export function getEnhancedNodeTypes(): string[] {
  return [...ENHANCED_NODE_TYPES];
}
