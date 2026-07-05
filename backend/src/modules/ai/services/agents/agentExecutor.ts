/**
 * Agent 执行器 — 向后兼容的 re-export
 *
 * 实现已拆分至独立文件：
 * - agentCore.ts          核心编排逻辑 (executeAgentNode, 工具调用, Native FC)
 * - serverCommandAgent.ts  服务器命令执行 Agent
 * - inspectionAgent.ts    自动巡检 Agent
 * - databaseAdminAgent.ts 数据库运维 Agent
 * - agentThinking.ts      思考步骤展示
 */
export {
  executeAgentNode,
  getAgent,
  extractToolCallFromResponse,
  executeToolCall,
  buildSystemPromptWithTools,
  _executeAgentNodeWithTools,
} from './agentCore';
export type { ToolExecutionResult, AgentExecutionContext } from './agentCore';

export { executeServerCommandAgent, inferCommandByInput } from './serverCommandAgent';
export { executeAutoInspectionAgent } from './inspectionAgent';
export { executeDatabaseAdminAgent } from './databaseAdminAgent';
export { getThinkingSteps } from './agentThinking';