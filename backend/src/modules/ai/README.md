# AI 模块 (`ai/`)

> **DDD 限界上下文**：AI 能力编排（LLM、Agent、RCA、知识库、自动修复）
> **聚合根**：`Agent`、`LLM Provider`、`Knowledge`
> **最后刷新**：2026-07-22（基于 12,943 行实测）

## 职责
AI 能力编排：大语言模型调用、Agent 管理、根因分析、知识库、自动修复建议。

## 内部结构（2026-07-22 核对代码现状）
```
ai/
├── routes.ts               # 模块路由聚合入口（挂 9 个 mount，含 /mcp 代理）
├── routes/                 # 9 路由文件
│   ├── agentRoutes.ts      (14 行 re-export)
│   │   └── agent/          (2026-07-21 v2.15 拆分子目录)
│   │       ├── crudRoutes.ts          (236 行: list/get/create/update/delete + executions)
│   │       ├── statsRoutes.ts         (82 行: stats summary + test-input)
│   │       ├── executionRoutes.ts     (112 行: POST /:id/test 执行器调度)
│   │       ├── importExportRoutes.ts  (89 行: import + export)
│   │       ├── toolRoutes.ts          (139 行: tools/list + tools/test + tools/descriptions)
│   │       ├── presetTestInputs.ts     (22 行: 共享预设输入)
│   │       └── index.ts                (35 行: 路由聚合)
│   ├── aiModelRoutes.ts
│   ├── aiRemediationRoutes.ts
│   ├── copilotRoutes.ts
│   ├── knowledgeRoutes.ts
│   ├── knowledgeQAnythingRoutes.ts
│   ├── multiAgentRoutes.ts
│   └── rootCauseAnalysisRoutes.ts
├── services/               # 业务代码（详见 §关键说明 的规模）
│   ├── llm/llmService/             ← LLM 调用（多模型、熔断、超时控制、provider 适配器）
│   ├── multiAgent/                 ← 多 Agent 编排调度（Coordinator + Specialists + SpecialistRegistry）
│   ├── rca/                        ← 根因分析（rootCauseAnalysisService/ + rcaJobManager + localRuleEngine）
│   ├── agents/                     ← Agent 执行引擎（agentExecutor + agentCore + 3 个特殊 Agent + agentToolRegistry + agentMcpAdapter）
│   ├── remediation/                ← AI 修复（aiRemediationService + enhancedRAGService + 4 个步骤文件）
│   ├── providers/                  ← 业务数据 Provider（prometheus/elasticsearch/dingtalk/wecom/slack/kubernetes）
│   ├── models/                     ← AI 模型 CRUD（aiModelService）
│   ├── knowledge/                  ← 知识库（qanythingService）
│   ├── edge/                       ← 边缘 Agent（EdgeAgent + SystemCollector）
│   └── ...                         ← agentCrudService / knowledgeCrudService / agentExecutionCrudService / qanythingConfigService / KnowledgeEngine 等
└── prompts/               ← LLM prompt 模板（rcaPrompt / configRepairPrompts）
```

## 路由端点（受保护，路径前缀 `/api/v1/*`）

| 前缀 | 来源 routes 文件 | 说明 |
|------|------------------|------|
| `/agents/*` | `agentRoutes.ts` → `agent/` 子目录 | Agent CRUD + 执行 + 工具 + 导入导出（详见子目录 README） |
| `/knowledge/*` | `knowledgeRoutes.ts` | 知识库 CRUD |
| `/knowledge/qanything/*` | `knowledgeQAnythingRoutes.ts` | QAnything 知识库集成 |
| `/copilot/*` | `copilotRoutes.ts` | AI Copilot 对话 |
| `/root-cause-analysis/*` | `rootCauseAnalysisRoutes.ts` | 根因分析 |
| `/multi-agent/*` | `multiAgentRoutes.ts` | 多 Agent 协作 |
| `/ai-models/*` | `aiModelRoutes.ts` | AI 模型 CRUD |
| `/ai-remediations/*` | `aiRemediationRoutes.ts` | AI 修复建议 |
| `/mcp/*` | `routes.ts` 第 22 行 `router.use('/mcp', mcpGateway)` | **AI 内部使用的 MCP 网关代理**（与 `mcp/` 模块的 `/api/v1/mcp/*` 是不同路径） |

> **路径前缀说明**：`ai/routes.ts` 第 22 行的 `router.use('/mcp', mcpGateway)` 与 `_registry.ts` 的 `/api/v1` 组合后实际是 `/api/v1/mcp/*`，**与 `mcp/` 模块独立路由 `/api/v1/mcp/*` 形成两条等价路径**（均指向同一 `services/mcp/gateway.ts`）。前端 mcp 模块通过 `/api/v1/mcp/*` 调用，AI 模块内部 agent 通过 `agentMcpAdapter` 调用相同服务。

## 依赖关系
- 依赖 `auth/`（鉴权）、`alerts/`（告警数据源）、`mcp/`（AI 内部 tool 调用）
- 被 `workflow/`、`auto/` 调用

## 关键说明
- `ai/` 是 **全项目最大模块**（12,943 行 / 83 个 .ts，其中非测试 66 个 .ts / 11,220 行），是所有 AI 能力的聚合点
- `llm/llmService/` 集成了多模型（Doubao/OpenAI/LocalAI 三个内置 providerAdapters）、熔断器、重试逻辑
- 单一入口：`llm/llmService/index.ts` 是 barrel，统一导出 `generateCompletion` / `executeAgentWithLLM` 等
- 依赖方向：`circuitBreaker.ts → providerAdapters.ts → toolCalling.ts → index.ts`
- **providerAdapters.ts 子模块拆分**（2026-07-21 v2.16，原 585 行 → 63 行桶 + providerAdapters/ 8 文件）：
  - `types.ts` (68 行: ChatMessage/LLMTool/ToolCall/LLMResponse/LLMProviderConfig)
  - `providerConfigs.ts` (51 行: DOUBAO/OPENAI/LOCAL_AI_CONFIG)
  - `executionStats.ts` (52 行: recordAgentExecution + updateAgentStats)
  - `providerDispatch.ts` (135 行: callLLMAPI 核心调度)
  - `modelPool.ts` (75 行: buildProviderConfig + callModelWithConfig)
  - `availability.ts` (75 行: checkLLMAvailability)
  - `providerInfer.ts` (70 行: getProviderForModel)
  - `index.ts` (41 行: barrel export)
- `agents/agentExecutor.ts` 的特殊 Agent（命令执行/巡检/数据库管理员）连接真实服务，通用 Agent 仍在 mock 状态
- `providers/` 是业务数据 Provider（监控/通知），与 `llm/llmService/providerAdapters.ts`（LLM 适配器）是两套独立体系
