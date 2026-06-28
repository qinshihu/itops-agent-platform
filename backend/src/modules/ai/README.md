# AI 模块 (`ai/`)

## 职责
AI 能力编排：大语言模型调用、Agent 管理、根因分析、知识库、自动修复建议。

## 内部结构
```
ai/
├── routes/           # 6 路由文件（agents, models, rca, knowledge, chat, remediation）
├── services/         # 15+ 服务文件
│   ├── llmService.ts         ← LLM 调用（多模型、熔断、超时控制）
│   ├── multiAgentCollab.ts   ← 多 Agent 编排调度
│   ├── rootCauseAnalysis.ts  ← 根因分析
│   ├── agentExecutor.ts      ← Agent 执行引擎
│   └── ...
└── prompts/          ← LLM prompt 模板
```

## 依赖关系
- 依赖 `auth/`（鉴权）、`alerts/`（告警数据源）
- 被 `workflow/`、`auto/` 调用

## 关键说明
- `ai/` 是 **全项目最大模块**（11,920 行 / 41 文件），是所有 AI 能力的聚合点
- `llmService.ts` 集成了多模型（Doubao/OpenAI）、熔断器、重试逻辑
- `agentExecutor.ts` 的特殊 Agent（命令执行/巡检）连接真实服务，通用 Agent 仍在 mock 状态
