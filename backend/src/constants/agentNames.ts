/**
 * Agent 名称常量
 * 统一管理 agent 名称，避免硬编码字符串散落在各处
 */
export const AGENT_NAMES = {
  SERVER_COMMAND: '服务器命令执行',
  SYSTEM_INSPECTION: '系统巡检',
  AUTO_INSPECTION: '自动巡检',
  COMPLIANCE_CHECK: '合规检查',
  ALERT_HANDLER: '告警处理',
  FAULT_DIAGNOSIS: '故障诊断',
  LOG_ANALYSIS: '日志分析',
  CHANGE_EXECUTION: '变更执行',
  DOC_GENERATION: '文档生成',
} as const;

export type AgentName = (typeof AGENT_NAMES)[keyof typeof AGENT_NAMES];
