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
│   ├── WorkflowEditor.tsx                # 工作流编辑器入口 (124 行)
│   ├── workflow-editor/
│   │   ├── useWorkflowEditor.ts          # 编辑器数据 hook（v2.23 拆分后精简主入口 241 行）
│   │   ├── types.ts                      # 子模块类型
│   │   ├── NodeConfigPanel.tsx           # 节点配置面板
│   │   ├── WorkflowNodes.tsx             # 工作流节点
│   │   ├── NodePanel.tsx                 # 节点面板
│   │   ├── EditorToolbar.tsx             # 编辑器工具栏
│   │   ├── constants.ts                  # 6+ 常量 + NON_CORE_NODE_DEFAULTS（68 行）
│   │   ├── helpers.ts                    # pushHistory + validateWorkflowPure（64 行）
│   │   ├── dropHandlers.ts               # onDragOver + onDrop（144 行）
│   │   ├── eventHandlers.ts              # 7 个 event handler（117 行）
│   │   ├── nodeConfigUpdaters.ts         # 14 个 updateXxx（217 行）
│   │   ├── lifecycleHandlers.ts          # 5 个 lifecycle（153 行）
│   │   └── index.ts                      # barrel（24 行）
│   ├── WorkflowProviders.tsx             # 工作流提供者（精简主入口 64 行）
│   │   └── workflow-providers/
│   │       ├── types.ts                       # 接口 + TYPE_CONFIG（66 行）
│   │       ├── providerMeta.ts                # 8 项 provider meta 数据 + getter（271 行）
│   │       ├── useProvidersData.ts            # 全部 hooks + handlers（173 行）
│   │       ├── ProviderListPanel.tsx          # 左侧 list + search + filter（142 行）
│   │       ├── ProviderDetailPanel.tsx        # 右侧 detail 含 5 sections（299 行）
│   │       ├── ProviderTestRunner.tsx         # 测试执行器（136 行）
│   │       └── index.ts                       # barrel（11 行）
│   ├── Tasks/                           # 任务管理（v2.10 拆分后由其他 AI 完成，用户/AI 已删除主文件）
│   │   ├── index.tsx                    # Tasks 主入口（101 行）
│   │   ├── useTasks.ts                  # data fetch / websocket / mutations（231 行）
│   │   ├── TaskList.tsx                 # 左侧 sidebar 列表（61 行）
│   │   ├── TaskDetail.tsx               # 右侧详情 + tabs + node flow（203 行）
│   │   ├── TaskLogs.tsx                 # 日志 tab（57 行）
│   │   ├── TaskNodes.tsx                # 节点结果 tab（124 行）
│   │   ├── TaskReports.tsx              # 相关报告 tab（72 行）
│   │   └── RetryConfirmModal.tsx        # 失败重投 modal（63 行）
│   └── ScheduledTasks.tsx                # 定时任务
└── index.ts
```

## 对应后端
`backend/src/modules/workflow/`

## 刷新记录
- **2026-07-22**：核对 v2.10/2.23 拆分后的 workflow-editor/Tasks 子模块结构