# AI 模块（前端）

## 职责
AI 能力编排：Agent 管理、大模型配置、知识库、根因分析、修复建议、AI 洞察。

## 内部结构
```
ai/
├── routes.ts                             # 模块路由（懒加载 7 个页面）
├── api.ts                                # API 类型与调用（约 350 行）
├── pages/
│   ├── Agents.tsx                        # Agent 入口（re-export 到 agents/index）
│   ├── agents/
│   │   ├── AgentList.tsx                 # Agent 列表
│   │   ├── AgentEditor.tsx               # Agent 编辑
│   │   ├── AgentDetail.tsx               # Agent 详情
│   │   ├── AgentToolsPage.tsx            # Agent 工具管理页（/agents/tools）
│   │   ├── AgentTestPanel.tsx            # Agent 测试面板
│   │   ├── AgentEditorTestModal.tsx      # 测试弹窗
│   │   ├── useAgents.ts                  # Agent 数据 hook
│   │   ├── types.ts                      # 子模块类型
│   │   └── tool/                         # 工具管理子模块（v2.1 P2 拆分，2026-07-21）
│   │       ├── SchemaTable.tsx           # JSON Schema 表格组件
│   │       ├── ToolTestPanel.tsx        # 工具测试面板
│   │       ├── ToolHistoryPanel.tsx      # 历史记录面板
│   │       └── types.ts                  # tool 子模块类型
│   ├── ai-models/                        # AI 模型管理（v5 拆为子目录）
│   │   ├── index.tsx                     # 模型管理入口
│   │   ├── useAIModels.ts                # AI 模型数据 hook
│   │   ├── ModelList.tsx                 # 模型列表
│   │   ├── ModelFormModal.tsx            # 模型表单弹窗
│   │   └── types.ts                      # 子模块类型
│   ├── ai-insights/                      # AI 洞察（v5 拆为子目录）
│   │   ├── index.tsx                     # 洞察入口
│   │   └── types.ts                      # 子模块类型
│   ├── RootCauseAnalysis.tsx             # 根因分析
│   ├── RCADetail.tsx                     # 根因分析详情
│   ├── AiRemediations.tsx                # AI 修复建议
│   ├── AIInsights.tsx                    # AI 洞察入口（路由 /ai-insights 懒加载）
│   └── Knowledge.tsx                     # 知识库管理
└── components/
    ├── ChatWidget.tsx                    # 聊天窗口
    └── RecommendationCard.tsx            # 推荐卡片
```

## 路由端点（受保护）

| 路径 | 组件 | 说明 |
|------|------|------|
| `/agents` | `Agents.tsx` | Agent 列表 |
| `/agents/tools` | `agents/AgentToolsPage` | Agent 工具管理（独立子页） |
| `/knowledge` | `Knowledge.tsx` | 知识库管理 |
| `/root-cause-analysis` | `RootCauseAnalysis` | 根因分析 |
| `/ai-root-cause` | `RootCauseAnalysis` | 兼容旧路径（合并自 v1 AIRootCause） |
| `/ai-root-cause/:id` | `RCADetail` | RCA 详情 |
| `/ai-insights` | `AIInsights` | AI 洞察 |
| `/ai-remediations` | `AiRemediations` | AI 修复建议 |

> AI 模型管理已迁移至 `/settings` 的 models Tab（见 [frontend/src/modules/settings](../settings)）。

## 对应后端
`backend/src/modules/ai/`

## 刷新记录
- **2026-07-22**：核对 9 个页面 + agents/tool/ 子目录（SchemaTable / ToolTestPanel / ToolHistoryPanel）