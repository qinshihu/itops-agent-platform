# 工作流模块（前端）

## 职责
可视化工作流编排：工作流列表、流程编辑器、任务管理、定时任务、工作流提供者配置。

## 内部结构
```
workflow/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   ├── Workflows.tsx                     # 工作流入口（1 行，re-export）
│   ├── workflows-list/
│   │   ├── index.tsx                     # 工作流列表主页
│   │   ├── WorkflowCard.tsx              # 工作流卡片
│   │   ├── WorkflowToolbar.tsx           # 工具栏
│   │   ├── ServerSelectModal.tsx         # 服务器选择弹窗
│   │   ├── DeleteConfirmModal.tsx        # 删除确认弹窗
│   │   └── types.ts                      # 子模块类型
│   ├── WorkflowEditor.tsx                # 工作流编辑器入口 (123 行)
│   ├── workflow-editor/
│   │   ├── useWorkflowEditor.ts          # 编辑器数据 hook
│   │   ├── types.ts                      # 子模块类型
│   │   ├── NodeConfigPanel.tsx           # 节点配置面板
│   │   ├── WorkflowNodes.tsx             # 工作流节点
│   │   ├── NodePanel.tsx                 # 节点面板
│   │   └── EditorToolbar.tsx             # 编辑器工具栏
│   ├── WorkflowProviders.tsx             # 工作流提供者
│   ├── Tasks.tsx                         # 任务管理
│   └── ScheduledTasks.tsx                # 定时任务
└── index.ts
```

## 对应后端
`backend/src/modules/workflow/`