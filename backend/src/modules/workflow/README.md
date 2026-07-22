# 工作流模块 (`workflow/`)

> **DDD 限界上下文**：工作流编排引擎
> **聚合根**：`Workflow`、`Task`、`ScheduledTask`
> **最后刷新**：2026-07-22

## 职责
工作流编排引擎：工作流定义、任务调度、定时任务（cron）、Bull 队列、节点执行器（基础 + 增强）、状态机。

## 路由端点（受保护）

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/workflows/*` | `workflowRoutes.ts` | 工作流定义 + 触发 + 状态查询 |
| `/tasks/*` | `taskRoutes.ts` | 任务实例 |
| `/scheduled-tasks/*` | `scheduledTaskRoutes.ts` | 定时任务（cron） |

## 内部结构
```
workflow/
├── routes/                          # 3 路由文件
│   ├── workflowRoutes.ts             ← 工作流定义/触发
│   ├── taskRoutes.ts                 ← 任务实例
│   └── scheduledTaskRoutes.ts        ← 定时任务
├── services/                         # 20+ 业务服务（含 3 个测试文件）
│   ├── workflowExecutor/             ← 工作流执行引擎（按子域拆分）
│   │   ├── index.ts                          (258 行 聚合入口)
│   │   ├── basicNodeHandlers.ts              (162 行)
│   │   ├── enhancedNodeHandlers.ts           (217 行 引用 enhancedNodeExecutor/)
│   │   ├── finalizeWorkflow.ts               (290 行)
│   │   ├── helpers.ts                        ( 83 行)
│   │   ├── layeredScheduler.ts               (125 行)
│   │   └── types.ts                          ( 37 行)
│   ├── enhancedNodeExecutor/        ← 增强节点执行器（2026-07-08 P1-7 拆分）
│   │   ├── index.ts                          ( 34 行 重导出)
│   │   ├── delay.ts                          ( 10 行)
│   │   ├── verificationNodeExecutor.ts       (257 行 5级验证门禁链)
│   │   ├── riskAssessNodeExecutor.ts         (115 行 三维风险量化)
│   │   ├── decisionNodeExecutor.ts           ( 89 行 规则匹配决策)
│   │   ├── knowledgeNodeExecutor.ts          ( 34 行 知识沉淀)
│   │   └── rollbackNodeExecutor.ts           ( 96 行 SSH 回滚 + 审计)
│   ├── WorkflowEngine.ts             ← 状态机（受保护聚合根：workflow.transitionTo()）
│   ├── workflowCrudService.ts        ← 工作流 CRUD
│   ├── taskCrudService.ts            ← 任务 CRUD
│   ├── scheduledTaskCrudService.ts   ← 定时任务 CRUD
│   ├── schedulerService.ts           ← 定时调度
│   ├── queueService.ts               ← 队列业务封装（Bull）
│   ├── queueBullAdapter.ts           ← Bull 适配器
│   ├── workflowNodeRegistry.ts       ← 节点类型注册表
│   ├── workflowProviderRegistry.ts   ← 工作流 Provider 注册表
│   ├── workflowExpressionEvaluator.ts← 表达式求值
│   └── ...
├── routes.ts
├── index.ts
└── README.md
```

## 依赖关系
- 依赖 `ai/`（Agent 执行）、`alerts/`（告警触发）
- 依赖 `audit/`（审计日志写入）
- 依赖 `servers/`（SSH 执行）
- 被 `auto/`（自动修复编排）依赖

## 关键说明
- **状态机保护**：`WorkflowEngine.ts` 是核心聚合根，`workflow.transitionTo()` 是唯一状态变更入口（外部不可直接修改 `status / currentNodeId / result`）
- **`workflowExecutor.test.ts`**（289 行）是项目最大最完整的测试文件
- **`enhancedNodeExecutor/` 子目录**是 P1-7 拆分（2026-07-08），原 586 行单文件按节点类型拆为 5 个独立执行器 + 1 个工具函数 + 1 个聚合入口，**0 个新增 tsc 错误**（验证依据见 v4 报告增量-8）
- **`enhancedNodeExecutor/` 拆分决策**详见 [`.trae/adr/018-enhanced-node-executor-splitting.md`](../../../../../.trae/adr/018-enhanced-node-executor-splitting.md)
- **`queueService.test.ts` / `schedulerService.test.ts`**：队列与调度的测试覆盖