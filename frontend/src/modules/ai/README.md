# AI 模块（前端）

## 职责
AI 能力编排：Agent 管理、大模型配置、知识库、根因分析、修复建议、AI 洞察。

## 内部结构
```
ai/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (353 行)
├── pages/
│   ├── Agents.tsx                        # Agent 入口（123 行）
│   ├── agents/
│   │   ├── AgentList.tsx                 # Agent 列表
│   │   ├── AgentEditor.tsx               # Agent 编辑
│   │   ├── AgentDetail.tsx               # Agent 详情
│   │   ├── AgentTestPanel.tsx            # Agent 测试面板
│   │   ├── AgentEditorTestModal.tsx      # 测试弹窗
│   │   ├── useAgents.ts                  # Agent 数据 hook
│   │   └── types.ts                      # 子模块类型
│   ├── AIModels.tsx                      # 模型配置管理 (725 行)
│   ├── AIInsights.tsx                    # AI 分析洞察
│   ├── AIRootCause.tsx                   # 根因分析入口
│   ├── RootCauseAnalysis.tsx             # 根因分析
│   ├── RCADetail.tsx                     # 根因分析详情
│   ├── AiRemediations.tsx                # AI 修复建议
│   └── Knowledge.tsx                     # 知识库管理
└── components/
    ├── ChatWidget.tsx                    # 聊天窗口
    └── RecommendationCard.tsx            # 推荐卡片
```

## 对应后端
`backend/src/modules/ai/`