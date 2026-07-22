/**
 * Enhanced Node Executor 聚合入口
 *
 * 从原 enhancedNodeExecutor.ts 单文件拆分（2026-07-08 P1-7 拆分）。
 * 原 586 行单文件拆为 5 个独立节点执行器 + 1 个工具函数 + 本入口。
 *
 * 拆分动机：
 *   - 原文件 586 行，超过 architecture.md §3.2 "500 行单文件" 建议上限
 *   - 5 个节点类型（verification/risk_assess/decision/knowledge/rollback）
 *     各自独立，无内部状态共享，按节点类型拆分能显著降低阅读复杂度
 *   - 与 backend/src/modules/auto/services/remediationService/ 拆分模式保持一致
 *
 * 目录结构：
 *   enhancedNodeExecutor/
 *   ├── index.ts                      ← 本文件（重导出 + 类型）
 *   ├── delay.ts                      ← delay() 工具函数
 *   ├── verificationNodeExecutor.ts   ← executeVerificationNode
 *   ├── riskAssessNodeExecutor.ts     ← executeRiskAssessNode
 *   ├── decisionNodeExecutor.ts       ← executeDecisionNode
 *   ├── knowledgeNodeExecutor.ts      ← executeKnowledgeNode
 *   └── rollbackNodeExecutor.ts       ← executeRollbackNode
 *
 * 向后兼容：
 *   `import { executeXxx } from '../enhancedNodeExecutor'` 现在等价于
 *   `import { executeXxx } from '../enhancedNodeExecutor/index'`
 *   引用方 workflowExecutor/enhancedNodeHandlers.ts 已同步更新（仅 1 处）
 */
export { executeVerificationNode } from './verificationNodeExecutor';
export { executeRiskAssessNode } from './riskAssessNodeExecutor';
export { executeDecisionNode } from './decisionNodeExecutor';
export { executeKnowledgeNode } from './knowledgeNodeExecutor';
export { executeRollbackNode } from './rollbackNodeExecutor';
export { delay } from './delay';
